import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, User, Bell, Shield, HelpCircle, LogOut } from 'lucide-react';
import { BottomNavigation } from '@/components/BottomNavigation';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export const Settings = () => {
  const navigate = useNavigate();

  const settingsGroups = [
    {
      title: "Account",
      items: [
        { icon: User, label: "Profile Settings", description: "Update your personal information" },
        { icon: Bell, label: "Notifications", description: "Manage your notification preferences" },
        { icon: Shield, label: "Privacy & Security", description: "Control your privacy settings" }
      ]
    },
    {
      title: "Support",
      items: [
        { icon: HelpCircle, label: "Help & Support", description: "Get help or contact support" }
      ]
    }
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-card px-6 py-8">
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
      </div>

      <div className="px-6 space-y-6">
        {settingsGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-3">
            <h2 className="text-lg font-semibold text-muted-foreground px-2">{group.title}</h2>

            <Card className="bg-card rounded-3xl shadow-sm border-0">
              <CardContent className="p-0">
                {group.items.map((item, itemIndex) => (
                  <button
                    key={itemIndex}
                    onClick={() => toast.info(`${item.label} — coming soon`)}
                    className="w-full p-6 flex items-center justify-between hover:bg-accent transition-colors first:rounded-t-3xl last:rounded-b-3xl"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-accent rounded-full flex items-center justify-center">
                        <item.icon className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-foreground">{item.label}</div>
                        <div className="text-sm text-muted-foreground">{item.description}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>
        ))}

        {/* Logout Button */}
        <Card className="bg-white rounded-3xl shadow-sm border-0 mt-8">
          <CardContent className="p-0">
            <button
              onClick={handleLogout}
              className="w-full p-6 flex items-center gap-4 hover:bg-red-50 transition-colors rounded-3xl"
            >
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <LogOut className="w-5 h-5 text-red-600" />
              </div>
              <div className="text-left">
                <div className="font-semibold text-red-600">Log Out</div>
                <div className="text-sm text-gray-500">Sign out of your account</div>
              </div>
            </button>
          </CardContent>
        </Card>

        {/* App Version */}
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">Nutri AI v1.0.0</p>
        </div>
      </div>

      <BottomNavigation />
    </div>
  );
};

