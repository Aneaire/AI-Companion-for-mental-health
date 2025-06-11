import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

const expenseSchema = z.object({
  id: z.number().min(1, "ID must be a positive number"),
  title: z.string().min(1, "Title is required"),
  amount: z.number().min(0, "Amount must be a positive number"),
});

const createPostSchema = expenseSchema.omit({ id: true });

type Expense = z.infer<typeof expenseSchema>;
const fakeExpenses: Expense[] = [
  { id: 1, title: "Groceries", amount: 50 },
  { id: 2, title: "Utilities", amount: 100 },
  { id: 3, title: "Rent", amount: 1200 },
  { id: 4, title: "Transportation", amount: 200 },
  { id: 5, title: "Entertainment", amount: 150 },
  { id: 6, title: "Healthcare", amount: 300 },
  { id: 7, title: "Insurance", amount: 250 },
  { id: 8, title: "Education", amount: 400 },
  { id: 9, title: "Clothing", amount: 100 },
  { id: 10, title: "Miscellaneous", amount: 50 },
];

const expense = new Hono()
  .get("/", (c) => {
    return c.text("Test route is working!");
  })
  .post("/", zValidator("json", createPostSchema), async (c) => {
    const data = await c.req.valid("json");
    c.status(201);
    fakeExpenses.push({
      id: fakeExpenses.length + 1,
      title: data.title,
      amount: data.amount,
    });
    return c.json(data);
  })
  .get("/total-expenses", (c) => {
    const total = fakeExpenses.reduce(
      (acc, expense) => acc + expense.amount,
      0
    );
    return c.json({ total });
  })
  .get("/all-expenses", (c) => {
    return c.json(fakeExpenses);
  })
  .get("/:id{[0-9]+}", (c) => {
    const id = c.req.param("id");
    const expenseItem = fakeExpenses.find((item) => item.id === parseInt(id));
    if (!expenseItem) {
      return c.text("Expense not found", 404);
    }
    return c.json(expenseItem);
  });

export default expense;
