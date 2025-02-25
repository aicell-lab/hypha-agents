import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useHyphaStore } from '../../store/hyphaStore';

interface Tool {
  type: 'function';
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  fn: (args: any) => Promise<any>;
}

interface VoiceModeContextType {
  isRecording: boolean;
  startRecording: (config: {
    onItemCreated?: (item: any) => void;
    instructions?: string;
    voice?: string;
    temperature?: number;
    max_output_tokens?: number;
  }) => Promise<void>;
  stopRecording: () => Promise<void>;
  error: string | null;
  registerTools: (tools: Tool[]) => void;
  sendTextMessage: (text: string) => void;
  status: string;
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
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const { server } = useHyphaStore();
  
  // WebRTC related refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const registeredToolsRef = useRef<Record<string, Tool>>({});
  const callbacksRef = useRef<{
    onItemCreated?: (item: any) => void;
  }>({});

  // Function to register tools
  const registerTools = useCallback((tools: Tool[]) => {
    const toolsMap = tools.reduce((acc, tool) => {
      acc[tool.name] = tool;
      return acc;
    }, {} as Record<string, Tool>);
    registeredToolsRef.current = toolsMap;
  }, []);

  // Function to send text messages
  const sendTextMessage = useCallback((text: string) => {
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

      // Then create a new response
      const responseCreate = {
        type: 'response.create'
        // response: {
        //   modalities: ['text', 'audio'],
        //   instructions: "Please assist the user.",
        //   voice: "sage",
        //   output_audio_format: "pcm16",
        //   tools: Object.values(registeredToolsRef.current).map(({ fn, ...tool }) => tool),
        //   tool_choice: "auto",
        //   temperature: 0.8,
        //   max_output_tokens: 1024
        // }
      };
      dataChannelRef.current.send(JSON.stringify(responseCreate));
    }
    else {
      console.error('Data channel not open, sending text message failed');
    }
  }, []);

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
            callbacksRef.current.onItemCreated?.(transcriptMessage.item);
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
            callbacksRef.current.onItemCreated?.(textMessage.item);
          }
          break;

        case 'response.function_call_arguments.done':
          setStatus('Executing function...');
          const tool = registeredToolsRef.current[msg.name];
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
            callbacksRef.current.onItemCreated?.(textMessage.item);
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
          callbacksRef.current.onItemCreated?.(msg.item);
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

  const startRecording = useCallback(async (config: {
    onItemCreated?: (item: any) => void;
    instructions?: string;
    voice?: string;
    temperature?: number;
    max_output_tokens?: number;
  }) => {
    try {
      // Store callbacks in ref for use in message handler
      callbacksRef.current = config;

      setStatus('Initializing...');
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
        
        // Send session update with registered tools
        const event = {
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: `${config.instructions || "You are a helpful assistant."}\n\n
            When displaying outputs from code execution, you can use special div tags to embed different types of content:
            
            1. For images:
            <div data-type="image" data-id="[output_id]" data-alt="[description]"></div>
            
            2. For HTML content:
            <div data-type="html" data-id="[output_id]"></div>
            
            3. For SVG content:
            <div data-type="svg" data-id="[output_id]"></div>
            
            These tags will be automatically replaced with the actual content when rendered.
            Always preserve these tags exactly as they appear in the output.
            When describing images or plots, include the div tag followed by a description of what the image shows.`,
            voice: config.voice || "sage",
            output_audio_format: "pcm16",
            tools: Object.values(registeredToolsRef.current).map(({ fn, ...tool }) => tool),
            tool_choice: "auto",
            temperature: config.temperature || 0.8,
          }
        };
        dc.send(JSON.stringify(event));
      };

      dc.onclose = () => {
        console.log('Data channel closed');
        setStatus('Disconnected');
      };

      dc.onerror = async (error) => {
        console.error('Data channel error:', error);
        // Stop recording when data channel error occurs
        await stopRecording();
        setError('Data channel error occurred');
        setStatus('Connection error');
      };

      dc.onmessage = handleDataChannelMessage;

      // Log ICE connection state changes
      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
        setStatus(`ICE: ${pc.iceConnectionState}`);
      };

      // Create and set local description
      setStatus('Creating connection...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send the offer to OpenAI's realtime API
      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";
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

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      console.error('Recording error:', err);
      setStatus('Failed to connect');
      await stopRecording();
    }
  }, [server, handleDataChannelMessage]);

  const stopRecording = useCallback(async () => {
    try {
      setStatus('Stopping...');
      // Clear callbacks
      callbacksRef.current = {};
      
      // Stop and clean up media stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }

      // Close data channel
      if (dataChannelRef.current) {
        dataChannelRef.current.close();
        dataChannelRef.current = null;
      }

      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      // Clean up audio element
      if (audioElementRef.current) {
        audioElementRef.current.srcObject = null;
        audioElementRef.current = null;
      }

      setIsRecording(false);
      setStatus('Stopped');
    } catch (err) {
      console.error('Error stopping recording:', err);
      setError('Failed to stop recording properly');
      setStatus('Error stopping');
    }
  }, []);

  return (
    <VoiceModeContext.Provider value={{
      isRecording,
      startRecording,
      stopRecording,
      error,
      registerTools,
      sendTextMessage,
      status
    }}>
      {children}
    </VoiceModeContext.Provider>
  );
}; 