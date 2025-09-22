import { PersonaLibrary } from "@/components/persona/PersonaLibrary";
import { PersonaBuilder } from "@/components/persona/PersonaBuilder";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

function PersonaLibraryPage() {
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingPersona, setEditingPersona] = useState<any>(null);

  const handleCreateNew = () => {
    setEditingPersona(null);
    setShowBuilder(true);
  };

  const handleEditPersona = (persona: any) => {
    setEditingPersona(persona);
    setShowBuilder(true);
  };

  const handlePersonaCreated = (persona: any) => {
    console.log("Persona created:", persona);
    setShowBuilder(false);
    setEditingPersona(null);
  };

  const handleUsePersona = (persona: any) => {
    console.log("Using persona:", persona);
    // TODO: Navigate to impersonate page with selected persona
    // For now, just log the action
  };

  return (
    <>
      <PersonaLibrary
        onCreateNew={handleCreateNew}
        onEditPersona={handleEditPersona}
        onUsePersona={handleUsePersona}
      />

      <PersonaBuilder
        open={showBuilder}
        onOpenChange={setShowBuilder}
        initialData={editingPersona}
        onSuccess={handlePersonaCreated}
      />
    </>
  );
}

export default PersonaLibraryPage;

export const Route = createFileRoute("/persona-library")({
  component: PersonaLibraryPage,
});