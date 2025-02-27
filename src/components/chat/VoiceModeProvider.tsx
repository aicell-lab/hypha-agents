import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useHyphaStore } from '../../store/hyphaStore';
import { Tool } from './ToolProvider';
import { useTools } from './ToolProvider';

interface VoiceModeContextType {
  isRecording: boolean;
  isPaused: boolean;
  startTimeChat: (config: {
    onItemCreated?: (item: any) => void;
    instructions?: string;
    voice?: string;
    temperature?: number;
    tools?: Tool[];
  }) => Promise<void>;
  stopChat: () => Promise<void>;
  pauseChat: () => Promise<void>;
  resumeChat: () => Promise<void>;
  error: string | null;
  sendText: (text: string) => void;
  status: string;
  connectionState: string;
}

const VoiceModeContext = createContext<VoiceModeContextType | undefined>(undefined);

export const useVoiceMode = () => {
  const context = useContext(VoiceModeContext);
  if (!context) {
    throw new Error('useVoiceMode must be used within a VoiceModeProvider');
  }
  return context;
};

interface VoiceModeProviderProps {
  children: React.ReactNode;
}

interface OpenAISession {
  client_secret: {
    value: string;
  };
}

export const VoiceModeProvider: React.FC<VoiceModeProviderProps> = ({ children }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  const { server } = useHyphaStore();
  const { onToolsChange } = useTools();
  
  // WebRTC related refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordingConfigRef = useRef<{
    onItemCreated?: (item: any) => void;
    instructions?: string;
    voice?: string;
    temperature?: number;
    tools?: Tool[];
  }>({});
  // Connection lock to prevent multiple simultaneous connection attempts
  const connectionLockRef = useRef<boolean>(false);

  // Format tools for OpenAI function calling format
  const formatToolsForOpenAI = useCallback((tools?: Tool[]) => {
    if (!tools || tools.length === 0) return [];
    
    return tools.map(tool => ({
      name: tool.name,
      type: tool.type,
      description: tool.description, 
      parameters: tool.parameters
    }));
  }, []);

  // Update session when explicitly called
  const updateSession = useCallback((config?: {
    instructions?: string;
    voice?: string;
    temperature?: number;
    tools?: Tool[];
  }) => {
    console.log('Updating session:', config);

    if (dataChannelRef.current?.readyState === 'open') {
      // Use the passed config or fall back to the stored config
      const sessionConfig = config || recordingConfigRef.current;
      
      const event = {
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: `${sessionConfig?.instructions || "You are a helpful assistant."}\n\n
Since we are communicating through voice, please keep your responses brief, clear, and concise while maintaining accuracy. Aim for responses that are easy to listen to and understand.

Remember:
- Keep responses concise and to the point
- Use clear and natural language suitable for voice interaction
- Break complex information into digestible chunks
- Prioritize the most important information first`,
          voice: sessionConfig?.voice || "sage",
          output_audio_format: "pcm16",
          tools: formatToolsForOpenAI(sessionConfig?.tools),
          tool_choice: "auto",
          temperature: sessionConfig?.temperature || 0.8,
        }
      };
      dataChannelRef.current.send(JSON.stringify(event));
      console.log('======> updated session with config:', sessionConfig);
      console.log('======> registered tools:', formatToolsForOpenAI(sessionConfig?.tools));
    }
  }, [formatToolsForOpenAI]);

  // Handle data channel messages
  const handleDataChannelMessage = useCallback(async (e: MessageEvent) => {
    try {
      const msg = JSON.parse(e.data);
      console.log('Received message:', msg);
      
      switch (msg.type) {
        case 'response.content_part.done':
          if (msg.part?.type === 'audio' && msg.part?.transcript) {
            // Create a message item for the transcript
            const transcriptMessage = {
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'assistant',
                content: [
                  {
                    type: 'text',
                    text: msg.part.transcript
                  }
                ]
              }
            };
            console.log('Sending transcript message:', transcriptMessage);
            dataChannelRef.current?.send(JSON.stringify(transcriptMessage));
            recordingConfigRef.current.onItemCreated?.(transcriptMessage.item);
          } else if (msg.part?.type === 'text' && msg.part?.text) {
            // Create a message item for the text
            const textMessage = {
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'assistant',
                content: [
                  {
                    type: 'text',
                    text: msg.part.text
                  }
                ]
              }
            };
            console.log('Sending text message:', textMessage);
            dataChannelRef.current?.send(JSON.stringify(textMessage));
            recordingConfigRef.current.onItemCreated?.(textMessage.item);
          }
          break;

        case 'response.function_call_arguments.done':
          setStatus('Executing function...');
          const tool = recordingConfigRef.current.tools?.find(t => t.name === msg.name);
          if (tool?.fn) {
            console.log(`Calling local function ${msg.name} with ${msg.arguments}`);
            const args = JSON.parse(msg.arguments);

            let result;
            try {
              result = await tool.fn(args);
            } catch (error) {
              console.error('Error executing function:', error);
              // Send function call output event with error
              const outputEvent = {
                type: 'conversation.item.create',
                item: {
                      type: 'function_call_output',
                      call_id: msg.call_id,
                  output: "Error executing code: " + (error instanceof Error ? error.stack || error.message : String(error)),
                }
              };
              console.log('Sending function output event:', outputEvent);
              dataChannelRef.current?.send(JSON.stringify(outputEvent));
              dataChannelRef.current?.send(JSON.stringify({type: 'response.create'}));
              break;
            }
            
            // Send the function call output event
            const outputEvent = {
              type: 'conversation.item.create',
              item: {
                    type: 'function_call_output',
                    call_id: msg.call_id,
                output: typeof result === 'string' ? result : JSON.stringify(result)
              }
            };
            console.log('Sending function output event:', outputEvent);
            dataChannelRef.current?.send(JSON.stringify(outputEvent));
            // Continue the conversation
            dataChannelRef.current?.send(JSON.stringify({type: 'response.create'}));
          }
          break;

        case 'response.text.done':
          if (msg.text) {
            console.log('Received text response:', msg.text);
            // Create a message item for the text
            const textMessage = {
              type: 'conversation.item.create',
              item: {
                type: 'message',
                role: 'assistant',
                content: [
                  {
                    type: 'text',
                    text: msg.text
                  }
                ]
              }
            };
            console.log('Sending text message:', textMessage);
            dataChannelRef.current?.send(JSON.stringify(textMessage));
            recordingConfigRef.current.onItemCreated?.(textMessage.item);
          }
          setStatus('Response received');
          break;

        case 'error':
          console.error('Error occurred:', msg.error);
          setStatus('Error occurred');
          break;

        case 'response.create.started':
          setStatus('Assistant is thinking...');
          break;

        case 'response.create.completed':
          setStatus('Response completed');
          break;

        case 'response.audio.started':
          setStatus('Audio response started');
          break;

        case 'response.audio.completed':
          setStatus('Audio response completed');
          break;

        case 'response.function_call.started':
          setStatus(`Calling function: ${msg.name}`);
          break;

        case 'response.function_call.completed':
          setStatus('Function call completed');
          break;

        case 'response.text.started':
          setStatus('Receiving text response...');
          break;

        case 'conversation.item.created':
          setStatus('Message added to conversation');
          recordingConfigRef.current.onItemCreated?.(msg.item);
          break;
        
        case 'response.done':
          setStatus('Response completed');
          break;

        default:
          console.log('Unhandled message type:', msg.type, msg);
      }
    } catch (err) {
      console.error('Failed to parse data channel message:', err);
    }
  }, []);

  const startTimeChat = useCallback(async (config: {
    onItemCreated?: (item: any) => void;
    instructions?: string;
    voice?: string;
    temperature?: number;
    tools?: Tool[];
  }) => {
    // Declare and initialize timeout variable at the top of the function
    let lockTimeout: ReturnType<typeof setTimeout> | null = null;
    
    try {
      // Check if a connection attempt is already in progress
      if (connectionLockRef.current) {
        console.log('Connection attempt already in progress, ignoring this request');
        return;
      }
      
      // Set the connection lock
      connectionLockRef.current = true;
      
      // Set a timeout to release the lock if the connection attempt takes too long
      lockTimeout = setTimeout(() => {
        if (connectionLockRef.current) {
          console.log('Connection attempt timed out, releasing lock');
          connectionLockRef.current = false;
        }
      }, 30000); // 30 seconds timeout
      
      // Check if there's an existing connection and close it first
      if (isRecording || peerConnectionRef.current || dataChannelRef.current || mediaStreamRef.current) {
        console.log('Existing WebRTC connection detected, closing it before starting a new one');
        await stopChat();
        // Small delay to ensure cleanup is complete
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Store callbacks in ref for use in message handler
      recordingConfigRef.current = config;

      setStatus('Initializing...');
      console.log('======> Initializing chat with config:', config);
      console.log('======> Server:', server);
      console.log('======> available tools:', config.tools || []);
      const schemaAgents = await server?.getService("schema-agents");
      const session: OpenAISession = await schemaAgents?.get_realtime_token();
      const EPHEMERAL_KEY = session.client_secret.value;

      // Create a new RTCPeerConnection with STUN servers
      const pc = new RTCPeerConnection({
        iceServers: [
          {
            urls: 'stun:stun.l.google.com:19302'
          }
        ]
      });
      peerConnectionRef.current = pc;

      // Set up audio element for remote audio from the model
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };
      audioElementRef.current = audioEl;

      // Get microphone access and add local audio track
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      mediaStreamRef.current = stream;
      pc.addTrack(stream.getTracks()[0]);

      setStatus('Setting up data channel...');
      // Set up data channel for events
      const dc = pc.createDataChannel("oai-events");
      dataChannelRef.current = dc;

      // Set up data channel event handlers
      dc.onopen = () => {
        console.log('Data channel opened');
        setStatus('Connected');
        
        // Send session update with the provided configuration
        updateSession(config);
      };

      dc.onclose = () => {
        console.log('Data channel closed');
        setStatus('Disconnected');
      };

      dc.onerror = async (error) => {
        console.error('Data channel error:', error);
        // Stop recording when data channel error occurs
        await stopChat();
        setError('Data channel error occurred');
        setStatus('Connection error');
      };

      dc.onmessage = handleDataChannelMessage;

      // Log ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
        setConnectionState(pc.iceConnectionState);
        setStatus(`ICE: ${pc.iceConnectionState}`);
        
        // Auto-cleanup on disconnected or failed states
        if (['disconnected', 'failed', 'closed'].includes(pc.iceConnectionState)) {
          console.log('Connection state indicates WebRTC disconnection, cleaning up resources');
          stopChat().catch(err => {
            console.error('Error during auto-cleanup:', err);
          });
        }
      };

      // Create and set local description
      setStatus('Creating connection...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send the offer to OpenAI's realtime API
      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview";
      const response = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp"
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to connect to OpenAI: ${response.statusText}`);
      }

      // Set the remote description with OpenAI's answer
      const answer: RTCSessionDescriptionInit = {
        type: 'answer',
        sdp: await response.text(),
      };
      await pc.setRemoteDescription(answer);

      setIsRecording(true);
      setError(null);
      setStatus('Ready');
      
      // Clear the timeout and release the connection lock
      if (lockTimeout) {
        clearTimeout(lockTimeout);
      }
      connectionLockRef.current = false;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      console.error('Recording error:', err);
      setStatus('Failed to connect');
      setConnectionState('failed');
      await stopChat();
      
      // Clear the timeout and release the connection lock
      if (lockTimeout) {
        clearTimeout(lockTimeout);
      }
      connectionLockRef.current = false;
    }
  }, [server, handleDataChannelMessage, updateSession, formatToolsForOpenAI]);

  const stopChat = useCallback(async () => {
    try {
      setStatus('Stopping...');
      setIsPaused(false);
      setConnectionState('disconnected');
      // Clear callbacks
      recordingConfigRef.current = {};
      
      // Stop and clean up media stream
      if (mediaStreamRef.current) {
        try {
          mediaStreamRef.current.getTracks().forEach(track => {
            try {
              track.stop();
            } catch (trackErr) {
              console.warn('Error stopping media track:', trackErr);
            }
          });
        } catch (streamErr) {
          console.warn('Error stopping media stream:', streamErr);
        }
        mediaStreamRef.current = null;
      }

      // Close data channel
      if (dataChannelRef.current) {
        try {
          if (dataChannelRef.current.readyState === 'open') {
            dataChannelRef.current.close();
          }
        } catch (dcErr) {
          console.warn('Error closing data channel:', dcErr);
        }
        dataChannelRef.current = null;
      }

      // Close peer connection
      if (peerConnectionRef.current) {
        try {
          peerConnectionRef.current.close();
        } catch (pcErr) {
          console.warn('Error closing peer connection:', pcErr);
        }
        peerConnectionRef.current = null;
      }

      // Clean up audio element
      if (audioElementRef.current) {
        try {
          audioElementRef.current.srcObject = null;
          audioElementRef.current.remove();
        } catch (audioErr) {
          console.warn('Error cleaning up audio element:', audioErr);
        }
        audioElementRef.current = null;
      }

      setIsRecording(false);
      setStatus('Stopped');
      
      // Release the connection lock to allow new connections
      connectionLockRef.current = false;
    } catch (err) {
      console.error('Error stopping recording:', err);
      setError('Failed to stop recording properly');
      setStatus('Error stopping');
      
      // Force reset of all references even if errors occurred
      mediaStreamRef.current = null;
      dataChannelRef.current = null;
      peerConnectionRef.current = null;
      audioElementRef.current = null;
      setIsRecording(false);
      
      // Release the connection lock even on error
      connectionLockRef.current = false;
    }
  }, []);

  const pauseChat = useCallback(async () => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.enabled = false);
        setIsPaused(true);
        setStatus('Paused');
      }
    } catch (err) {
      console.error('Error pausing recording:', err);
      setError('Failed to pause recording');
    }
  }, []);

  const resumeChat = useCallback(async () => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.enabled = true);
        setIsPaused(false);
        setStatus('Recording resumed');
      }
    } catch (err) {
      console.error('Error resuming recording:', err);
      setError('Failed to resume recording');
    }
  }, []);

  // Send text message
  const sendText = useCallback((text: string) => {
    if (dataChannelRef.current?.readyState === 'open') {
      // First create and send the message
      const messageCreate = {
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: text
            }
          ]
        }
      };
      dataChannelRef.current.send(JSON.stringify(messageCreate));
      const responseCreate = {
        type: 'response.create'
      };
      dataChannelRef.current.send(JSON.stringify(responseCreate));
    }
    else {
      console.error('Data channel not open, sending text message failed');
    }
  }, []);

  // Register a callback to update the session when tools change
  useEffect(() => {
    // Only set up the listener if we're recording and onToolsChange is available
    if (isRecording && dataChannelRef.current?.readyState === 'open' && onToolsChange) {
      const unsubscribe = onToolsChange((updatedTools) => {
        console.log('Tools changed, updating session with new tools:', updatedTools);
        updateSession({
          ...recordingConfigRef.current,
          tools: updatedTools
        });
      });
      
      return unsubscribe;
    }
  }, [isRecording, onToolsChange, updateSession]);

  return (
    <VoiceModeContext.Provider value={{
      isRecording,
      isPaused,
      startTimeChat,
      stopChat,
      pauseChat,
      resumeChat,
      error,
      sendText,
      status,
      connectionState
    }}>
      {children}
    </VoiceModeContext.Provider>
  );
}; 