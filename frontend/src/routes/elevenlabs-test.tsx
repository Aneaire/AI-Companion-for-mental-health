import { useConversation } from "@elevenlabs/react";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: Date;
}

function ElevenLabsTest() {
  const [agentId, setAgentId] = useState("JbfALvY8jVXqPIWpLxH9"); // Default ElevenLabs agent
  const [messages, setMessages] = useState<Message[]>([]);
  const [textInput, setTextInput] = useState("");
  const [volume, setVolume] = useState([0.8]);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const [connectionType, setConnectionType] = useState<"webrtc" | "websocket">("webrtc");
  const [serverLocation, setServerLocation] = useState<"us" | "eu-residency" | "in-residency" | "global">("us");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [inputVolume, setInputVolume] = useState(0);
  const [outputVolume, setOutputVolume] = useState(0);

  const conversation = useConversation({
    onConnect: () => {
      toast.success("Connected to ElevenLabs agent");
      console.log("Connected to conversation");
    },
    onDisconnect: () => {
      toast.info("Disconnected from agent");
      console.log("Disconnected from conversation");
    },
    onMessage: (message) => {
      console.log("Received message:", message);
      const newMessage: Message = {
        id: Date.now().toString(),
        role: message.role === "user" ? "user" : "assistant",
        text: message.message,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
    },
    onError: (error) => {
      console.error("Conversation error:", error);
      toast.error(`Conversation error: ${error.message}`);
    },
    onModeChange: ({ mode }) => {
      console.log("Mode changed:", mode);
    },
    onStatusChange: ({ status }) => {
      console.log("Status changed:", status);
    },
    onAudio: (audio) => {
      console.log("Audio received:", audio);
    },
  });

  // Request microphone permission
  const requestMicPermission = useCallback(async () => {
    setIsRequestingMic(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermissionGranted(true);
      toast.success("Microphone permission granted");
    } catch (error) {
      console.error("Microphone permission denied:", error);
      toast.error("Microphone permission denied");
      setMicPermissionGranted(false);
    } finally {
      setIsRequestingMic(false);
    }
  }, []);

  // Check if microphone permission is already granted
  useEffect(() => {
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((result) => {
        if (result.state === "granted") {
          setMicPermissionGranted(true);
        }
      })
      .catch(() => {
        // Fallback: try to get user media
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then(() => setMicPermissionGranted(true))
          .catch(() => setMicPermissionGranted(false));
      });
  }, []);

  // Update audio levels
  useEffect(() => {
    if (conversation.status !== "connected") return;

    const interval = setInterval(() => {
      setInputVolume(conversation.getInputVolume());
      setOutputVolume(conversation.getOutputVolume());
    }, 100);

    return () => clearInterval(interval);
  }, [conversation.status, conversation]);

  // Start conversation session
  const startConversation = useCallback(async () => {
    if (!micPermissionGranted) {
      toast.error("Please grant microphone permission first");
      return;
    }

    if (!agentId.trim()) {
      toast.error("Please enter an Agent ID");
      return;
    }

    try {
      const conversationId = await conversation.startSession({
        agentId: agentId.trim(),
        connectionType,
        serverLocation,
      });
      console.log("Started conversation:", conversationId);
    } catch (error) {
      console.error("Failed to start conversation:", error);
      toast.error("Failed to start conversation");
    }
  }, [agentId, micPermissionGranted, conversation, connectionType, serverLocation]);

  // End conversation session
  const endConversation = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (error) {
      console.error("Failed to end conversation:", error);
    }
  }, [conversation]);

  // Send text message
  const sendTextMessage = useCallback(() => {
    if (!textInput.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      text: textInput.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    conversation.sendUserMessage(textInput.trim());
    setTextInput("");
  }, [textInput, conversation]);

  // Send feedback
  const sendFeedback = useCallback((positive: boolean) => {
    if (conversation.canSendFeedback) {
      conversation.sendFeedback(positive);
      toast.success(`Feedback sent: ${positive ? "Positive" : "Negative"}`);
    } else {
      toast.error("Cannot send feedback at this time");
    }
  }, [conversation]);

  // Get conversation ID
  const getConversationId = useCallback(() => {
    const id = conversation.getId();
    if (id) {
      navigator.clipboard.writeText(id);
      toast.success("Conversation ID copied to clipboard");
    }
  }, [conversation]);

  // Handle Enter key in text input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTextMessage();
    }
  };

  // Update volume
  const handleVolumeChange = useCallback((value: number[]) => {
    setVolume(value);
    conversation.setVolume({ volume: value[0] });
  }, [conversation]);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">ElevenLabs React SDK Test</h1>
        <p className="text-gray-600">
          Test the ElevenLabs conversational AI agent integration with React
        </p>
      </div>

      {/* Microphone Permission */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Microphone Permission</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant={micPermissionGranted ? "default" : "destructive"}>
              {micPermissionGranted ? "Granted" : "Not Granted"}
            </Badge>
            {!micPermissionGranted && (
              <Button
                onClick={requestMicPermission}
                disabled={isRequestingMic}
              >
                {isRequestingMic ? "Requesting..." : "Request Permission"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Agent Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Agent Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="agentId">Agent ID</Label>
              <Input
                id="agentId"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                placeholder="Enter ElevenLabs Agent ID"
                className="mt-1"
              />
              <p className="text-sm text-gray-500 mt-1">
                Get this from your ElevenLabs dashboard
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="showAdvanced"
                checked={showAdvanced}
                onChange={(e) => setShowAdvanced(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="showAdvanced">Show advanced options</Label>
            </div>

            {showAdvanced && (
              <div className="space-y-4 border-t pt-4">
                <div>
                  <Label>Connection Type</Label>
                  <select
                    value={connectionType}
                    onChange={(e) => setConnectionType(e.target.value as "webrtc" | "websocket")}
                    className="w-full mt-1 p-2 border rounded"
                  >
                    <option value="webrtc">WebRTC (Recommended)</option>
                    <option value="websocket">WebSocket</option>
                  </select>
                </div>

                <div>
                  <Label>Server Location</Label>
                  <select
                    value={serverLocation}
                    onChange={(e) => setServerLocation(e.target.value as any)}
                    className="w-full mt-1 p-2 border rounded"
                  >
                    <option value="us">United States</option>
                    <option value="eu-residency">EU Residency</option>
                    <option value="in-residency">India Residency</option>
                    <option value="global">Global</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Connection Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Connection Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <Badge variant={
              conversation.status === "connected" ? "default" :
              conversation.status === "connecting" ? "secondary" :
              "outline"
            }>
              Status: {conversation.status}
            </Badge>
            <Badge variant={conversation.isSpeaking ? "default" : "outline"}>
              {conversation.isSpeaking ? "Speaking" : "Listening"}
            </Badge>
            <Button
              onClick={startConversation}
              disabled={conversation.status === "connected" || !micPermissionGranted}
            >
              Start Conversation
            </Button>
            <Button
              onClick={endConversation}
              disabled={conversation.status !== "connected"}
              variant="destructive"
            >
              End Conversation
            </Button>
          </div>

          {/* Conversation ID */}
          {conversation.status === "connected" && (
            <div className="mb-4">
              <Label>Conversation ID</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={conversation.getId() || ""}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button onClick={getConversationId} variant="outline" size="sm">
                  Copy
                </Button>
              </div>
            </div>
          )}

          {/* Audio Levels */}
          <div className="mb-4">
            <Label className="mb-2 block">Audio Levels</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Input: {Math.round(inputVolume * 100)}%</Label>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-100"
                    style={{ width: `${inputVolume * 100}%` }}
                  ></div>
                </div>
              </div>
              <div>
                <Label className="text-sm">Output: {Math.round(outputVolume * 100)}%</Label>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-100"
                    style={{ width: `${outputVolume * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

          {/* Volume Control */}
          <div className="mb-4">
            <Label>Master Volume: {Math.round(volume[0] * 100)}%</Label>
            <Slider
              value={volume}
              onValueChange={handleVolumeChange}
              max={1}
              min={0}
              step={0.1}
              className="mt-2"
            />
          </div>

          {/* Feedback */}
          {conversation.canSendFeedback && (
            <div>
              <Label className="mb-2 block">Rate this conversation:</Label>
              <div className="flex gap-2">
                <Button
                  onClick={() => sendFeedback(true)}
                  variant="outline"
                  size="sm"
                  className="text-green-600"
                >
                  👍 Good
                </Button>
                <Button
                  onClick={() => sendFeedback(false)}
                  variant="outline"
                  size="sm"
                  className="text-red-600"
                >
                  👎 Poor
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Text Input */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Send Text Message</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message here..."
              className="flex-1"
              rows={2}
            />
            <Button
              onClick={sendTextMessage}
              disabled={!textInput.trim() || conversation.status !== "connected"}
            >
              Send
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No messages yet. Start a conversation to see messages here.
              </p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`p-3 rounded-lg ${
                    message.role === "user"
                      ? "bg-blue-50 ml-12"
                      : "bg-gray-50 mr-12"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <Badge variant={message.role === "user" ? "default" : "secondary"}>
                      {message.role}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm">{message.text}</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ElevenLabsTest;

export const Route = createFileRoute("/elevenlabs-test")({
  component: ElevenLabsTest,
});