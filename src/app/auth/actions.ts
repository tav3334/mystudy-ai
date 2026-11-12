"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabase } from "@/lib/supabase/server";
import { appUrl, hasSupabase } from "@/lib/env";
export async function authenticate(
  _: { error?: string; message?: string },
  form: FormData,
): Promise<{ error?: string; message?: string }> {
  if (!hasSupabase())
    return {
      error: "Configurez Supabase dans .env.local pour activer la connexion.",
    };
  const parsed = z
    .object({
      email: z.email(),
      password: z.string().min(8).max(128),
      mode: z.enum(["login", "signup"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      error:
        "Saisissez un e-mail valide et un mot de passe de 8 caractères minimum.",
    };
  const db = await supabase();
  const { email, password, mode } = parsed.data;
  if (mode === "signup") {
    const { error } = await db.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${appUrl()}/auth/callback` },
    });
    return error
      ? { error: "Inscription impossible. Réessayez ou connectez-vous." }
      : {
          message:
            "Vérifiez votre boîte e-mail pour confirmer votre inscription.",
        };
  }
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) return { error: "E-mail ou mot de passe incorrect." };
  redirect("/");
}
export async function signOut() {
  if (hasSupabase()) {
    const db = await supabase();
    await db.auth.signOut();
  }
  redirect("/login");
}
