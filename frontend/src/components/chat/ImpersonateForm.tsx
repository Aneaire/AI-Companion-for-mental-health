import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const impersonateSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  age: z.string().min(1, "Age is required"),
  problemDescription: z.string().min(1, "Problem description is required"),
  background: z.string().optional(),
  personality: z.string().optional(),
});

export type ImpersonateFormData = z.infer<typeof impersonateSchema>;

interface ImpersonateFormProps {
  onSubmit: (data: ImpersonateFormData) => void;
}

export function ImpersonateForm({
  onSubmit,
}: ImpersonateFormProps): JSX.Element {
  const form = useForm<ImpersonateFormData>({
    resolver: zodResolver(impersonateSchema),
    defaultValues: {
      fullName: "",
      age: "",
      problemDescription: "",
      background: "",
      personality: "",
    },
  });

  const handleSubmit = async (data: ImpersonateFormData) => {
    onSubmit(data);
  };

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div>
        <label>Full Name</label>
        <input {...form.register("fullName")} />
      </div>
      <div>
        <label>Age</label>
        <input {...form.register("age")} />
      </div>
      <div>
        <label>Problem Description</label>
        <textarea {...form.register("problemDescription")} />
      </div>
      <div>
        <label>Background (optional)</label>
        <textarea {...form.register("background")} />
      </div>
      <div>
        <label>Personality (optional)</label>
        <textarea {...form.register("personality")} />
      </div>
      <button type="submit">Submit</button>
    </form>
  );
}
