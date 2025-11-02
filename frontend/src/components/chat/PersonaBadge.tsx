import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Brain, AlertTriangle, Users, Anchor, Target, Shield } from 'lucide-react';

interface PersonaBadgeProps {
  persona: string | null;
  rationale?: string | null;
  isVisible?: boolean;
}

const personaConfig = {
  empathetic_listener: {
    name: 'Empathetic Listener',
    icon: Heart,
    color: 'bg-pink-100 text-pink-800 border-pink-200',
    description: 'Providing emotional support'
  },
  wise_guide: {
    name: 'Wise Guide',
    icon: Brain,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'Offering guidance and advice'
  },
  friendly_companion: {
    name: 'Friendly Companion',
    icon: MessageCircle,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'Engaging in conversation'
  },
  direct_engager: {
    name: 'Direct Engager',
    icon: Users,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    description: 'Encouraging engagement'
  },
  crisis_support: {
    name: 'Crisis Support',
    icon: AlertTriangle,
    color: 'bg-red-100 text-red-800 border-red-200',
    description: 'Providing crisis intervention'
  },
  calm_anchor: {
    name: 'Calm Anchor',
    icon: Anchor,
    color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    description: 'De-escalating tension and providing calm presence'
  },
  direct_confrontational: {
    name: 'Direct Confrontational',
    icon: Target,
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    description: 'Providing honest feedback and accountability'
  },
  firm: {
    name: 'Firm Clarifier',
    icon: Shield,
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    description: 'Requiring clear communication and honesty'
  }
};

export function PersonaBadge({ persona, rationale, isVisible = true }: PersonaBadgeProps) {
  if (!isVisible || !persona) return null;

  const config = personaConfig[persona as keyof typeof personaConfig];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Badge 
      variant="outline" 
      className={`${config.color} border flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium`}
      title={`${config.name} - ${config.description}${rationale ? ` (Reason: ${rationale})` : ''}`}
    >
      <Icon className="w-3 h-3" />
      <span>{config.name}</span>
    </Badge>
  );
}