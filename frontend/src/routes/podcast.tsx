import { createFileRoute } from "@tanstack/react-router";
import { useBackgroundMusic } from "@/hooks/useBackgroundMusic";
import { useChatStore } from "@/stores/chatStore";
import { Music } from "lucide-react";

export const Route = createFileRoute("/podcast")({
  component: RouteComponent,
});

function RouteComponent() {
  const { conversationPreferences } = useChatStore();
  
  // Auto-play background music on podcast page
  useBackgroundMusic("podcast");

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Podcast View</h1>
      <p className="text-gray-600">
        This is the podcast view where background music will auto-play when enabled.
      </p>
      
      <div className="mt-8 p-6 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Podcast Features</h2>
        <ul className="space-y-2 text-gray-700">
          <li>• Background music auto-play</li>
          <li>• Word-by-word highlighting</li>
          <li>• Audio synchronization</li>
          <li>• Customizable settings</li>
        </ul>
      </div>
      
      <div className="mt-8 p-6 bg-blue-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Music size={20} />
          Background Music Status
        </h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Auto-play on Podcast:</span>
            <span className={conversationPreferences.autoPlayMusicOnPodcast ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
              {conversationPreferences.autoPlayMusicOnPodcast ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Current Track:</span>
            <span className="font-medium">{conversationPreferences.podcastMusicTrack || "ambient-piano"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Volume:</span>
            <span className="font-medium">{Math.round((conversationPreferences.podcastMusicVolume || 0.3) * 100)}%</span>
          </div>
        </div>
        <p className="mt-4 text-xs text-gray-500">
          Music will auto-play when this setting is enabled. Configure settings in Thread Settings.
        </p>
      </div>
    </div>
  );
}

