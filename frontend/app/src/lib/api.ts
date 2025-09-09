export async function login(email: string, password: string) {
  const res = await fetch("http://localhost:8000/api/accounts/token/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error("Login failed");
  }
  return res.json(); // { access: "JWT", refresh: "JWT" }
}
