export const revalidate = 0; // ISRを無効にして常に最新データ取得（開発用）

async function getHelloMessage() {
  const res = await fetch("http://backend:8000/api/hello/", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch API");
  return res.json();
}

export default async function HelloPage() {
  const data = await getHelloMessage();

  return (
    <div>
      <h1>API Response</h1>
      <p>{data.message}</p>
    </div>
  );
}
