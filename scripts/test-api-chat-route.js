const fetch = require("node-fetch");

async function testChatRoute() {
  const url = "http://localhost:3000/api/chat"; // 请根据本地端口调整
  const body = {
    messages: [
      { content: "Hello, what's the weather?" }
    ],
    sessionId: "test-session-1"
  };
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    console.log("Response status:", response.status);
    console.log("Response data:", data);
  } catch (err) {
    console.error("Error:", err);
  }
}

testChatRoute();