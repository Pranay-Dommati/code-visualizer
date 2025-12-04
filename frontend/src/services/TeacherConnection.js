import { commandProcessor } from './CommandProcessor';

class TeacherConnection {
    constructor() {
        this.ws = null;
        this.audioContext = null;
        this.workletNode = null;
        this.mediaStream = null;
        this.isConnected = false;
        this.listeners = new Set();
        this.audioQueue = [];
        this.nextStartTime = 0;
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify(status) {
        this.listeners.forEach(listener => listener(status));
    }

    async connect() {
        if (this.isConnected) return;

        try {
            // Connect WebSocket first
            this.ws = new WebSocket('ws://localhost:5000/ws/teacher');

            this.ws.onopen = async () => {
                console.log('✓ Connected to Teacher Backend');
                this.isConnected = true;
                this.notify('connected');

                // Initialize audio after connection
                await this.initAudio();
            };

            this.ws.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (e) {
                    console.error('Failed to parse message:', e);
                }
            };

            this.ws.onclose = () => {
                console.log('Disconnected from Teacher Backend');
                this.isConnected = false;
                this.notify('disconnected');
                this.cleanup();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.notify('error');
            };

        } catch (error) {
            console.error('Connection failed:', error);
            this.notify('error');
        }
    }

    async initAudio() {
        try {
            // Create AudioContext at 16kHz for Gemini
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });

            // Load AudioWorklet
            await this.audioContext.audioWorklet.addModule('/audio-processor.js');

            // Get microphone
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');

            this.workletNode.port.onmessage = (event) => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    const float32Data = event.data;

                    // Convert Float32 to PCM16
                    const pcm16 = this.float32ToPCM16(float32Data);

                    // Convert to base64
                    const base64 = this.arrayBufferToBase64(pcm16.buffer);

                    // Send to backend
                    this.ws.send(JSON.stringify({ audio: base64 }));
                }
            };

            source.connect(this.workletNode);
            // Don't connect to destination to avoid echo

            console.log('✓ Audio initialized');

        } catch (error) {
            console.error('Audio init failed:', error);
        }
    }

    float32ToPCM16(float32Array) {
        const pcm16 = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return pcm16;
    }

    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    handleMessage(data) {
        // Handle drawing commands
        if (data.action) {
            commandProcessor.process(data);
            return;
        }

        // Handle audio output from Gemini
        if (data.serverContent) {
            const content = data.serverContent;
            const parts = content.modelTurn?.parts || [];

            for (const part of parts) {
                // Handle audio
                if (part.inlineData?.mimeType?.startsWith('audio/')) {
                    this.playAudio(part.inlineData.data);
                }

                // Handle text (check for embedded JSON commands)
                if (part.text) {
                    const text = part.text;
                    const lines = text.split('\n');

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed.startsWith('{') && trimmed.includes('action')) {
                            try {
                                const cmd = JSON.parse(trimmed);
                                commandProcessor.process(cmd);
                            } catch (e) {
                                // Not valid JSON, ignore
                            }
                        }
                    }
                }
            }
        }

        // Handle errors
        if (data.error) {
            console.error('Server error:', data.error);
        }
    }

    async playAudio(base64Audio) {
        if (!this.audioContext) return;

        try {
            // Decode base64 to ArrayBuffer
            const binary = atob(base64Audio);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            // Decode audio
            const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);

            // Play
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);

            const currentTime = this.audioContext.currentTime;
            const startTime = Math.max(currentTime, this.nextStartTime);

            source.start(startTime);
            this.nextStartTime = startTime + audioBuffer.duration;

        } catch (e) {
            console.error('Audio playback failed:', e);
        }
    }

    cleanup() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        if (this.workletNode) {
            this.workletNode.disconnect();
        }
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }

    stop() {
        this.cleanup();
        if (this.ws) {
            this.ws.close();
        }
        this.isConnected = false;
        this.notify('disconnected');
    }

    sendText(text) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ text }));
            console.log('→ Sent text:', text);
        }
    }
}

export const teacherConnection = new TeacherConnection();
