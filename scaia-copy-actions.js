/* Add copy + like/dislike feedback buttons to SCAIA bot messages */
(function () {
  function getMessagesBox() {
    return document.getElementById("scdChatMessages") ||
           document.getElementById("chatMessages") ||
           document.querySelector(".scdChatMessages");
  }

  function getPreviousUserQuestion(botMsg) {
    let node = botMsg.previousElementSibling;
    while (node) {
      if (node.classList && node.classList.contains("user")) {
        const bubble = node.querySelector(".scdBubble");
        return bubble ? (bubble.innerText || bubble.textContent || "").trim() : "";
      }
      node = node.previousElementSibling;
    }
    return "";
  }

  async function sendFeedback(payload) {
    try {
      await fetch("/scaia-feedback", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn("Feedback save failed:", e);
    }
  }

  function iconCopy() {
    return `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="10" height="10" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
  }

  function iconLike() {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 22V10"></path><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"></path></svg>`;
  }

  function iconDislike() {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 2v12"></path><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"></path></svg>`;
  }

  function addActionButtons() {
    const box = getMessagesBox();
    if (!box) return;

    box.querySelectorAll(".scdMsg.bot").forEach((msg) => {
      if (msg.querySelector(".scaiaMsgActions")) return;

      const bubble = msg.querySelector(".scdBubble");
      if (!bubble) return;

      const actions = document.createElement("div");
      actions.className = "scaiaMsgActions";

      const copyBtn = document.createElement("button");
      copyBtn.className = "scaiaActionBtn scaiaCopyBtn";
      copyBtn.type = "button";
      copyBtn.title = "Copy";
      copyBtn.innerHTML = iconCopy();

      const likeBtn = document.createElement("button");
      likeBtn.className = "scaiaActionBtn scaiaLikeBtn";
      likeBtn.type = "button";
      likeBtn.title = "Good response";
      likeBtn.innerHTML = iconLike();

      const dislikeBtn = document.createElement("button");
      dislikeBtn.className = "scaiaActionBtn scaiaDislikeBtn";
      dislikeBtn.type = "button";
      dislikeBtn.title = "Bad response";
      dislikeBtn.innerHTML = iconDislike();

      copyBtn.addEventListener("click", async function () {
        const text = bubble.innerText || bubble.textContent || "";
        try {
          await navigator.clipboard.writeText(text.trim());
          copyBtn.textContent = "Copied";
          setTimeout(() => copyBtn.innerHTML = iconCopy(), 1200);
        } catch (err) {
          const textarea = document.createElement("textarea");
          textarea.value = text.trim();
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand("copy");
          textarea.remove();
          copyBtn.textContent = "Copied";
          setTimeout(() => copyBtn.innerHTML = iconCopy(), 1200);
        }
      });

      likeBtn.addEventListener("click", async function () {
        likeBtn.classList.add("selected");
        dislikeBtn.classList.remove("selected");

        const answer = bubble.innerText || bubble.textContent || "";
        const question = getPreviousUserQuestion(msg);

        await sendFeedback({
          rating: "like",
          reason: "",
          corrected_answer: "",
          question,
          answer,
          page: window.location.href
        });

        likeBtn.textContent = "Thanks";
        setTimeout(() => likeBtn.innerHTML = iconLike(), 1200);
      });

      dislikeBtn.addEventListener("click", async function () {
        dislikeBtn.classList.add("selected");
        likeBtn.classList.remove("selected");

        const answer = bubble.innerText || bubble.textContent || "";
        const question = getPreviousUserQuestion(msg);

        const reason = prompt("وش المشكلة في الرد؟ What was wrong?") || "";
        const corrected = prompt("وش الرد الصحيح أو القاعدة اللي تبغين SCAIA يتعلمها؟ Suggested correction/rule:") || "";

        await sendFeedback({
          rating: "dislike",
          reason,
          corrected_answer: corrected,
          question,
          answer,
          page: window.location.href
        });

        dislikeBtn.textContent = "Sent";
        setTimeout(() => dislikeBtn.innerHTML = iconDislike(), 1200);
      });

      actions.appendChild(copyBtn);
      actions.appendChild(likeBtn);
      actions.appendChild(dislikeBtn);
      msg.appendChild(actions);
    });
  }

  document.addEventListener("DOMContentLoaded", addActionButtons);
  window.addEventListener("load", addActionButtons);
  setInterval(addActionButtons, 700);
})();
