export async function signup(name: string, email: string, password: string) {
  const res = await fetch("http://localhost:8000/api/accounts/register/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    console.error("Signup error:", errorData);
    throw new Error("Signup failed");
  }
  return res.json();
}
