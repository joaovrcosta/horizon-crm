import { z } from "zod";
import { htmlToPlainText } from "@/lib/email-body";

export const composeEmailSchema = z.object({
  to: z
    .string()
    .trim()
    .min(1, "Informe o destinatário.")
    .refine((value) => value.includes("@"), {
      message: "Informe um e-mail válido ou selecione um cliente.",
    }),
  subject: z
    .string()
    .trim()
    .min(1, "Informe o assunto do e-mail.")
    .max(300, "O assunto deve ter no máximo 300 caracteres."),
  body: z.string().refine((html) => Boolean(htmlToPlainText(html)), {
    message: "Escreva o corpo do e-mail.",
  }),
});

export type ComposeEmailValues = z.infer<typeof composeEmailSchema>;
