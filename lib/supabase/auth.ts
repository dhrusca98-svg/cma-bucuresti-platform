import { supabase } from "./client";

export async function signIn(
  email: string,
  password: string
) {
  return await supabase.auth.signInWithPassword({
    email,
    password,
  });
}

export async function signUp(
  email: string,
  password: string
) {
  return await supabase.auth.signUp({
    email,
    password,
  });
}


export async function signOut() {
  return await supabase.auth.signOut();
}

export async function resetPassword(
  email: string
) {
  return await supabase.auth.resetPasswordForEmail(
    email,
    {
      redirectTo:
        "http://localhost:3000/reset-password",
    }
  );
}

export async function getSession() {
  return await supabase.auth.getSession();
}