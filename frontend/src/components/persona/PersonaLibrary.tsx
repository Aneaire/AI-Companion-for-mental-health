import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Filter, Grid, List, Plus, Share, Download, Eye, Edit, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { personaLibraryApi, personaTemplatesApi } from "@/lib/client";

interface Persona {
  id: number;
  fullName: string;
  age: string;
  category?: string;
  complexityLevel: string;
  isPublic: boolean;
  usageCount: number;
  lastUsedAt?: string;
  evolutionStage: string;
  createdAt: string;
  updatedAt: string;
  templateName?: string;
}

interface PersonaLibraryProps {
  onCreateNew?: () => void;
  onEditPersona?: (persona: Persona) => void;
  onUsePersona?: (persona: Persona) => void;
}

export function PersonaLibrary({ onCreateNew, onEditPersona, onUsePersona }: PersonaLibraryProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [complexityFilter, setComplexityFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"my-personas" | "public-personas">("my-personas");
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const queryClient = useQueryClient();

  // Fetch user's persona library
  const { data: myPersonas, isLoading: myPersonasLoading } = useQuery({
    queryKey: ["personaLibrary", "my-personas", categoryFilter, complexityFilter, searchQuery],
    queryFn: () => personaLibraryApi.list({
      category: categoryFilter === "all" ? undefined : categoryFilter,
      complexityLevel: complexityFilter === "all" ? undefined : complexityFilter,
      search: searchQuery || undefined,
      limit: 50,
    }),
    enabled: activeTab === "my-personas",
  });

  // Fetch public personas
  const { data: publicPersonas, isLoading: publicPersonasLoading } = useQuery({
    queryKey: ["personaLibrary", "public-personas", categoryFilter, complexityFilter, searchQuery],
    queryFn: () => personaLibraryApi.browsePublic({
      category: categoryFilter === "all" ? undefined : categoryFilter,
      complexityLevel: complexityFilter === "all" ? undefined : complexityFilter,
      search: searchQuery || undefined,
      limit: 50,
    }),
    enabled: activeTab === "public-personas",
  });

  // Delete persona mutation
  const deleteMutation = useMutation({
    mutationFn: (personaId: number) => personaLibraryApi.delete(personaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personaLibrary"] });
      toast.success("Persona deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete persona");
    },
  });

  // Share persona mutation
  const shareMutation = useMutation({
    mutationFn: ({ personaId, isPublic }: { personaId: number; isPublic: boolean }) =>
      personaLibraryApi.share({ personaId, isPublic }),
    onSuccess: (_, { isPublic }) => {
      queryClient.invalidateQueries({ queryKey: ["personaLibrary"] });
      toast.success(`Persona ${isPublic ? 'shared publicly' : 'made private'}`);
    },
    onError: () => {
      toast.error("Failed to update persona sharing");
    },
  });

  // Import persona mutation
  const importMutation = useMutation({
    mutationFn: (sourcePersonaId: number) =>
      personaLibraryApi.import({ sourcePersonaId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personaLibrary"] });
      toast.success("Persona imported successfully");
    },
    onError: () => {
      toast.error("Failed to import persona");
    },
  });

  const currentPersonas = activeTab === "my-personas" ? myPersonas?.personas : publicPersonas?.personas;
  const isLoading = activeTab === "my-personas" ? myPersonasLoading : publicPersonasLoading;

  const handleDeletePersona = (persona: Persona) => {
    if (confirm(`Are you sure you want to delete "${persona.fullName}"? This action cannot be undone.`)) {
      deleteMutation.mutate(persona.id);
    }
  };

  const handleSharePersona = (persona: Persona) => {
    shareMutation.mutate({ personaId: persona.id, isPublic: !persona.isPublic });
  };

  const handleImportPersona = (persona: Persona) => {
    importMutation.mutate(persona.id);
  };

  const handleViewDetails = (persona: Persona) => {
    setSelectedPersona(persona);
    setShowDetailsDialog(true);
  };

  const getComplexityColor = (level: string) => {
    switch (level) {
      case "basic": return "bg-green-100 text-green-800";
      case "intermediate": return "bg-yellow-100 text-yellow-800";
      case "advanced": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getEvolutionColor = (stage: string) => {
    switch (stage) {
      case "initial": return "bg-blue-100 text-blue-800";
      case "developing": return "bg-purple-100 text-purple-800";
      case "mature": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const PersonaCard = ({ persona }: { persona: Persona }) => (
    <Card className="h-full hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg line-clamp-1">{persona.fullName}</CardTitle>
            <CardDescription className="text-sm">
              Age {persona.age} • {persona.category || 'Uncategorized'}
            </CardDescription>
          </div>
          {persona.isPublic && (
            <Badge variant="secondary" className="ml-2">
              <Share size={12} className="mr-1" />
              Public
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge className={getComplexityColor(persona.complexityLevel)}>
            {persona.complexityLevel}
          </Badge>
          <Badge className={getEvolutionColor(persona.evolutionStage)}>
            {persona.evolutionStage}
          </Badge>
        </div>

        <div className="text-sm text-gray-600 mb-4">
          <div>Used {persona.usageCount} times</div>
          {persona.lastUsedAt && (
            <div>Last used {new Date(persona.lastUsedAt).toLocaleDateString()}</div>
          )}
          {persona.templateName && (
            <div>Based on: {persona.templateName}</div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {activeTab === "my-personas" ? (
            <>
              <Button
                size="sm"
                onClick={() => onUsePersona?.(persona)}
                className="flex-1"
              >
                Use Persona
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleViewDetails(persona)}
              >
                <Eye size={14} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEditPersona?.(persona)}
              >
                <Edit size={14} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSharePersona(persona)}
              >
                <Share size={14} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDeletePersona(persona)}
              >
                <Trash2 size={14} />
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => handleViewDetails(persona)}
                className="flex-1"
              >
                View Details
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleImportPersona(persona)}
                disabled={importMutation.isPending}
              >
                <Download size={14} className="mr-1" />
                Import
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const PersonaListItem = ({ persona }: { persona: Persona }) => (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-lg">{persona.fullName}</h3>
              <Badge className={getComplexityColor(persona.complexityLevel)}>
                {persona.complexityLevel}
              </Badge>
              <Badge className={getEvolutionColor(persona.evolutionStage)}>
                {persona.evolutionStage}
              </Badge>
              {persona.isPublic && (
                <Badge variant="secondary">
                  <Share size={12} className="mr-1" />
                  Public
                </Badge>
              )}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Age {persona.age} • {persona.category || 'Uncategorized'} •
              Used {persona.usageCount} times
              {persona.lastUsedAt && ` • Last used ${new Date(persona.lastUsedAt).toLocaleDateString()}`}
              {persona.templateName && ` • Based on: ${persona.templateName}`}
            </div>
          </div>
          <div className="flex gap-2">
            {activeTab === "my-personas" ? (
              <>
                <Button size="sm" onClick={() => onUsePersona?.(persona)}>
                  Use Persona
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleViewDetails(persona)}>
                  <Eye size={14} />
                </Button>
                <Button size="sm" variant="outline" onClick={() => onEditPersona?.(persona)}>
                  <Edit size={14} />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleSharePersona(persona)}>
                  <Share size={14} />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDeletePersona(persona)}>
                  <Trash2 size={14} />
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" onClick={() => handleViewDetails(persona)}>
                  View Details
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleImportPersona(persona)}
                  disabled={importMutation.isPending}
                >
                  <Download size={14} className="mr-1" />
                  Import
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="w-full max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Persona Library</h1>
          <p className="text-gray-600 mt-1">
            Manage and organize your therapy personas
          </p>
        </div>
        <Button onClick={onCreateNew} className="flex items-center gap-2">
          <Plus size={16} />
          Create New Persona
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <Input
              placeholder="Search personas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="anxiety">Anxiety</SelectItem>
            <SelectItem value="depression">Depression</SelectItem>
            <SelectItem value="trauma">Trauma</SelectItem>
            <SelectItem value="relationship">Relationship</SelectItem>
            <SelectItem value="career">Career</SelectItem>
          </SelectContent>
        </Select>
        <Select value={complexityFilter} onValueChange={setComplexityFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Complexity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <Grid size={16} />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List size={16} />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="mb-6">
          <TabsTrigger value="my-personas">My Personas</TabsTrigger>
          <TabsTrigger value="public-personas">Public Personas</TabsTrigger>
        </TabsList>

        <TabsContent value="my-personas" className="mt-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : currentPersonas?.length ? (
            <div className={
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                : "space-y-4"
            }>
              {currentPersonas.map((persona) => (
                viewMode === "grid" ? (
                  <PersonaCard key={persona.id} persona={persona} />
                ) : (
                  <PersonaListItem key={persona.id} persona={persona} />
                )
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Star size={48} className="mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No personas found</h3>
              <p className="text-gray-600 mb-4">
                {searchQuery || categoryFilter !== "all" || complexityFilter !== "all"
                  ? "Try adjusting your filters or search terms."
                  : "Create your first persona to get started."}
              </p>
              <Button onClick={onCreateNew}>
                <Plus size={16} className="mr-2" />
                Create New Persona
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="public-personas" className="mt-0">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : currentPersonas?.length ? (
            <div className={
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                : "space-y-4"
            }>
              {currentPersonas.map((persona) => (
                viewMode === "grid" ? (
                  <PersonaCard key={persona.id} persona={persona} />
                ) : (
                  <PersonaListItem key={persona.id} persona={persona} />
                )
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <Share size={48} className="mx-auto" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No public personas found</h3>
              <p className="text-gray-600">
                No public personas match your current filters.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Persona Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedPersona?.fullName}</DialogTitle>
            <DialogDescription>
              Detailed information about this persona
            </DialogDescription>
          </DialogHeader>
          {selectedPersona && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Age</label>
                  <p className="text-sm text-gray-900">{selectedPersona.age}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Category</label>
                  <p className="text-sm text-gray-900">{selectedPersona.category || 'Uncategorized'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Complexity</label>
                  <Badge className={getComplexityColor(selectedPersona.complexityLevel)}>
                    {selectedPersona.complexityLevel}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Evolution Stage</label>
                  <Badge className={getEvolutionColor(selectedPersona.evolutionStage)}>
                    {selectedPersona.evolutionStage}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Usage Statistics</label>
                <div className="text-sm text-gray-900">
                  Used {selectedPersona.usageCount} times
                  {selectedPersona.lastUsedAt && (
                    <> • Last used {new Date(selectedPersona.lastUsedAt).toLocaleDateString()}</>
                  )}
                </div>
              </div>

              {selectedPersona.templateName && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Based on Template</label>
                  <p className="text-sm text-gray-900">{selectedPersona.templateName}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                {activeTab === "my-personas" ? (
                  <>
                    <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                      Close
                    </Button>
                    <Button onClick={() => onUsePersona?.(selectedPersona)}>
                      Use Persona
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                      Close
                    </Button>
                    <Button
                      onClick={() => handleImportPersona(selectedPersona)}
                      disabled={importMutation.isPending}
                    >
                      <Download size={14} className="mr-1" />
                      Import Persona
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}