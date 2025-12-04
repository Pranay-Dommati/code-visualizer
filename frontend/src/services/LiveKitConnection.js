import { Room, RoomEvent, RemoteAudioTrack } from "livekit-client";

class LiveKitConnection {
    constructor() {
        this.room = null;
        this.audioElement = null;
        this.onDrawingCommand = null;
        this.onConnectionStateChange = null;
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
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(state);
            }
        });

        // Handle incoming tracks (AI voice)
        this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            if (track.kind === "audio") {
                this.handleAudioTrack(track);
            }
        });

        // Handle incoming data packets (drawing commands)
        this.room.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
            const strData = new TextDecoder().decode(payload);
            try {
                const command = JSON.parse(strData);
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

    handleAudioTrack(track) {
        if (!this.audioElement) {
            this.audioElement = document.createElement("audio");
            this.audioElement.autoplay = true;
            document.body.appendChild(this.audioElement);
        }
        track.attach(this.audioElement);
    }

    async startMicrophone() {
        if (!this.room) return;
        try {
            await this.room.localParticipant.setMicrophoneEnabled(true);
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

    disconnect() {
        if (this.room) {
            this.room.disconnect();
            this.room = null;
        }
        if (this.audioElement) {
            this.audioElement.remove();
            this.audioElement = null;
        }
    }
}

export default new LiveKitConnection();
