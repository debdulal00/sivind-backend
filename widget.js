(function () {
  const config = window.SIVIND_WIDGET || {};
  const storeId = config.storeId;

  if (!storeId) {
    console.error("SIVIND: Missing storeId");
    return;
  }

  let customerId = localStorage.getItem("sivind_customer_id");
  if (!customerId) {
    customerId = crypto.randomUUID();
    localStorage.setItem("sivind_customer_id", customerId);
  }

  const style = document.createElement("style");
  style.innerHTML = `
  #sivind-box {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 320px;
    height: 420px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 0 20px rgba(0,0,0,0.2);
    display: flex;
    flex-direction: column;
    font-family: Arial;
    z-index: 99999;
  }
  #sivind-header {
    background: #4f46e5;
    color: white;
    padding: 12px;
    font-weight: bold;
  }
  #sivind-messages {
    flex: 1;
    padding: 10px;
    overflow-y: auto;
  }
  #sivind-input {
    border: none;
    border-top: 1px solid #ddd;
    padding: 10px;
    outline: none;
  }
  .me { text-align: right; margin: 6px; }
  .ai { text-align: left; margin: 6px; color: #4f46e5; }
  `;
  document.head.appendChild(style);

  const box = document.createElement("div");
  box.innerHTML = `
    <div id="sivind-box">
      <div id="sivind-header">Chat with us</div>
      <div id="sivind-messages"></div>
      <input id="sivind-input" placeholder="Type here..." />
    </div>
  `;
  document.body.appendChild(box);

  document.getElementById("sivind-input").addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      const msg = e.target.value;
      e.target.value = "";

      const messages = document.getElementById("sivind-messages");
      messages.innerHTML += `<div class="me">${msg}</div>`;

      const res = await fetch("https://sivind-backend.onrender.com/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          customerId,
          message: msg
        })
      });

      const data = await res.json();
      messages.innerHTML += `<div class="ai">${data.reply}</div>`;
      messages.scrollTop = messages.scrollHeight;
    }
  });
})();
