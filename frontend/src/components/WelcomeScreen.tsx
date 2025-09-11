import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClerk, useUser } from "@clerk/clerk-react";
import {
  ArrowRightIcon,
  LockIcon as LockClosedIcon,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { UserProfileDialog } from "./UserProfileDialog";

export const WelcomeScreen = () => {
  const [activeTab, setActiveTab] = useState("signin");
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const { openSignIn, openSignUp } = useClerk();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && user) {
      // Check if user has a profile
      const checkUserProfile = async () => {
        try {
          const response = await fetch(`/api/user/profile/${user.id}`);
          if (response.status === 404) {
            // User doesn't have a profile yet, show the dialog
            setShowProfileDialog(true);
          }
        } catch (error) {
          console.error("Error checking user profile:", error);
        }
      };

      checkUserProfile();
    }
  }, [isLoaded, user]);

  // Use Clerk's direct methods instead of trying to click hidden elements
  const handleSignIn = () => {
    openSignIn();
  };

  const handleSignUp = () => {
    openSignUp();
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md px-4">
        <Card className="w-full shadow-xl border-0">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-2">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center p-2">
                {/* <Brain className="h-6 w-6 text-blue-600" /> */}
                <img
                  src="https://mental-health-ai-chat.onrender.com/logo2.png"
                  alt="logo"
                />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              AI Smart Therapist
            </CardTitle>
            <CardDescription className="text-slate-500">
              Your personal mental health companion
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue="signin"
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Create Account</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={handleSignIn}
                    >
                      <LockClosedIcon className="mr-2 h-4 w-4" />
                      Sign in with Clerk
                    </Button>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-slate-500">
                        Features
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-slate-700">
                        AI-powered mental wellness tools
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-slate-700">
                        Personalized support journey
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-blue-500" />
                      <span className="text-sm text-slate-700">
                        Private and secure conversations
                      </span>
                    </div>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="signup" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Button
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={handleSignUp}
                    >
                      <ArrowRightIcon className="mr-2 h-4 w-4" />
                      Create an account
                    </Button>
                  </div>
                  <div className="text-center text-sm">
                    <p className="text-slate-500">
                      Join thousands of users improving their mental wellbeing
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex flex-col space-y-2 text-xs text-center text-slate-500">
            <p>
              By continuing, you agree to our Terms of Service and Privacy
              Policy
            </p>
          </CardFooter>
        </Card>
      </div>

      {user && (
        <UserProfileDialog
          open={showProfileDialog}
          onOpenChange={setShowProfileDialog}
          clerkId={user.id}
        />
      )}
    </div>
  );
};
