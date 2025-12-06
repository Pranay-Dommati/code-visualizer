import { Room, RoomEvent, RemoteAudioTrack } from "livekit-client";

class LiveKitConnection {
    constructor() {
        this.room = null;
        this.audioElement = null;
        this.onDrawingCommand = null;
        this.onConnectionStateChange = null;
        this.pendingContext = null; // Store context to send after connection
        this.attachedTracks = new Set(); // Track attached audio tracks to prevent duplicates
    }

    async connect(token, url, onDrawingCommand, onConnectionStateChange) {
        this.onDrawingCommand = onDrawingCommand;
        this.onConnectionStateChange = onConnectionStateChange;

        this.room = new Room({
            adaptiveStream: true,
            dynacast: true,
        });

        // Handle connection state changes
        this.room.on(RoomEvent.ConnectionStateChanged, (state) => {
            console.log('🔌 Connection state changed:', state);
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(state);
            }
            
            // Send pending context once connected (with a small delay to ensure stability)
            if (state === 'connected' && this.pendingContext) {
                setTimeout(() => {
                    console.log('📤 Sending pending context after connection...');
                    this.sendContext(this.pendingContext);
                    this.pendingContext = null;
                }, 1000); // 1 second delay to let the agent fully initialize
            }
        });

        // Handle incoming tracks (AI voice)
        this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            console.log('📡 Track subscribed:', track.kind, 'from:', participant?.identity);
            if (track.kind === "audio") {
                this.handleAudioTrack(track, participant);
            }
        });
        
        // Handle track unsubscription to clean up
        this.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
            console.log('📡 Track unsubscribed:', track.kind, 'from:', participant?.identity);
            const trackId = track.sid || track.name || `${participant?.identity}-audio`;
            this.attachedTracks.delete(trackId);
        });

        // Handle incoming data packets (drawing commands)
        this.room.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
            const strData = new TextDecoder().decode(payload);
            try {
                const command = JSON.parse(strData);
                console.log('📥 Received drawing command:', command);
                if (this.onDrawingCommand) {
                    this.onDrawingCommand(command);
                }
            } catch (e) {
                console.error("Failed to parse data packet:", e);
            }
        });

        try {
            await this.room.connect(url, token);
            console.log("Connected to LiveKit room");

            // Publish microphone immediately if possible, or wait for user action
            // For now, we'll let the UI trigger microphone publishing
        } catch (error) {
            console.error("Failed to connect to LiveKit:", error);
            throw error;
        }
    }

    handleAudioTrack(track, participant) {
        // Prevent duplicate track attachments
        const trackId = track.sid || track.name || `${participant?.identity}-audio`;
        
        if (this.attachedTracks.has(trackId)) {
            console.log('⚠️ Audio track already attached, skipping:', trackId);
            return;
        }
        
        console.log('🔊 Attaching audio track:', trackId, 'from:', participant?.identity);
        
        if (!this.audioElement) {
            this.audioElement = document.createElement("audio");
            this.audioElement.autoplay = true;
            this.audioElement.id = "ai-teacher-audio";
            document.body.appendChild(this.audioElement);
        } else {
            // Detach any existing tracks first
            if (this.audioElement.srcObject) {
                console.log('🔇 Detaching previous audio');
            }
        }
        
        track.attach(this.audioElement);
        this.attachedTracks.add(trackId);
        console.log('✅ Audio track attached successfully');
    }

    async startMicrophone() {
        if (!this.room) return;
        try {
            // Use echo cancellation and noise suppression for cleaner audio
            await this.room.localParticipant.setMicrophoneEnabled(true, {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            });
            console.log('🎤 Microphone enabled with echo cancellation');
        } catch (error) {
            console.error("Failed to enable microphone:", error);
            throw error;
        }
    }

    async stopMicrophone() {
        if (!this.room) return;
        try {
            await this.room.localParticipant.setMicrophoneEnabled(false);
        } catch (error) {
            console.error("Failed to disable microphone:", error);
        }
    }

    async sendText(text) {
        if (!this.room) return;

        // Encode text as data packet
        const strData = JSON.stringify({ type: "user_text", text: text });
        const data = new TextEncoder().encode(strData);

        try {
            await this.room.localParticipant.publishData(data, { reliable: true });
        } catch (error) {
            console.error("Failed to send text data:", error);
        }
    }

    /**
     * Send code execution context to the AI Teacher agent
     * @param {Object} context - The context object containing code, steps, codeLines, variables
     */
    async sendContext(context) {
        if (!this.room || !this.room.localParticipant) {
            // Store context to send later when connected
            this.pendingContext = context;
            console.log('📋 Context queued for sending after connection');
            return;
        }

        const contextData = {
            type: "context_update",
            code: context.code || "",
            steps: context.steps || [],
            codeLines: context.codeLines || [],
            variables: context.variables || {}
        };

        const strData = JSON.stringify(contextData);
        const data = new TextEncoder().encode(strData);

        try {
            // Use DataPacket_Kind.RELIABLE for reliable delivery
            await this.room.localParticipant.publishData(data, { reliable: true });
            console.log('📤 Sent code execution context to AI Teacher, data size:', strData.length);
        } catch (error) {
            console.error("Failed to send context data:", error);
        }
    }

    /**
     * Set context before connecting - will be sent automatically after connection
     * @param {Object} context - The context object
     */
    setContext(context) {
        this.pendingContext = context;
    }

    disconnect() {
        console.log('🔌 Disconnecting from LiveKit room...');
        
        if (this.room) {
            this.room.disconnect();
            this.room = null;
        }
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.srcObject = null;
            this.audioElement.remove();
            this.audioElement = null;
        }
        
        // Reset all state
        this.attachedTracks.clear();
        this.pendingContext = null;
        
        console.log('✅ Disconnected and cleaned up');
    }
}

export default new LiveKitConnection();
