        // Disputes – collapsible
        // ──────────────────────────────────────────────
        async function fetchDisputes() {
          if (!adminToken) {
            if (disputesList) {
              disputesList.innerHTML =
                '<p class="text-center text-red-500">Please login to view disputes.</p>';
            }
            return;
          }
          if (disputesList) {
            disputesList.innerHTML =
              '<p class="text-center text-light-gray">Loading disputes...</p>';
          }
          try {
            const res = await fetch(`${BASE_URL}/api/admin/disputes`, {
              headers: { Authorization: `Bearer ${adminToken}` },
            });
            const data = await res.json();
            if (res.ok) {
              allDisputes = data;
              renderDisputes(data);
              updateAnalyticsView();
            } else {
              if (disputesList) {
                disputesList.innerHTML = `<p class="text-center text-red-500">${data.message || "Failed to load disputes"}</p>`;
              }
            }
          } catch (err) {
            if (disputesList) {
              disputesList.innerHTML = `<p class="text-center text-red-500">Network error</p>`;
            }
          }
        }

        function renderDisputes(disputes) {
          if (!disputesList) return;

          disputesList.innerHTML = "";
          if (!disputes.length) {
            disputesList.innerHTML =
              '<p class="text-center text-light-gray">No disputes found.</p>';
            return;
          }

          disputes.forEach((d) => {
            const card = document.createElement("div");
            card.className = "card dispute-card";

            const attHtml = d.attachments?.length
              ? d.attachments
                  .map(
                    (u) =>
                      `<img src="${u}" alt="Attachment" class="inline-block">`,
                  )
                  .join("")
              : '<p class="text-gray-500">No attachments</p>';

            const msgHtml = (d.messages || [])
              .map((m) => {
                const name =
                  m.senderType === "Admin"
                    ? "Admin"
                    : `${d.user?.firstName || "User"} ${d.user?.lastName || ""}`;
                const align = m.senderType === "Admin" ? "ml-auto" : "mr-auto";
                const bg =
                  m.senderType === "Admin" ? "bg-blue-600" : "bg-gray-600";
                return `<div class="chat-message ${align} ${bg}"><strong>${name}:</strong> ${m.text}</div>`;
              })
              .join("");

            const isResolved = d.status?.toLowerCase() === "resolved";

            card.innerHTML = `
                <h3 class="text-2xl font-semibold text-accent-cyan mb-3">Dispute ID: ${d._id}</h3>
                <p class="mb-1"><strong>User:</strong> ${d.user?.firstName || "N/A"} ${d.user?.lastName || ""} (<span class="text-accent-cyan">${d.user?.email || "N/A"}</span>)</p>
                <p class="mb-1"><strong>Order ID:</strong> ${d.order?._id || "N/A"}</p>
                <p class="mb-1"><strong>Status:</strong> <span class="font-bold text-lg text-red-400">${d.status}</span></p>
                <p class="mb-4"><strong>Reason:</strong> ${d.reason || "N/A"}</p>
                <h4 class="font-semibold mt-4 mb-2">Attachments:</h4>
                <div class="dispute-attachments flex flex-wrap">${attHtml}</div>
                <h4 class="font-semibold mt-6 mb-3">Chat History:</h4>
                <div class="chat-container flex flex-col">${msgHtml}</div>
                <form class="send-message-form mt-4" data-dispute-id="${d._id}">
                    <textarea class="input-field w-full mb-3" rows="3" placeholder="Reply..."></textarea>
                    <button type="submit" class="btn btn-primary py-2 px-6">Send Reply</button>
                </form>
                <div class="mt-6">
                    <button class="btn btn-success ${isResolved ? "opacity-50 cursor-not-allowed" : ""}" ${isResolved ? "disabled" : ""} data-dispute-id="${d._id}" data-status="resolved">
                        Mark as Resolved
                    </button>
                </div>
            `;
            disputesList.appendChild(card);
          });

          document.querySelectorAll(".send-message-form").forEach((form) => {
            form.addEventListener("submit", async (e) => {
              e.preventDefault();
              const id = form.dataset.disputeId;
              const ta = form.querySelector("textarea");
              const text = ta.value.trim();
              if (!text) return;
              await sendDisputeMessage(id, text);
              ta.value = "";
            });
          });

          document
            .querySelectorAll('[data-dispute-id][data-status="resolved"]')
            .forEach((btn) => {
              btn.addEventListener("click", async () => {
                await updateDisputeStatus(btn.dataset.disputeId, "resolved");
              });
            });
        }

        async function sendDisputeMessage(id, text) {
          try {
            const res = await fetch(
              `${BASE_URL}/api/admin/disputes/${id}/message`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify({ text }),
              },
            );
            if (res.ok) {
              displayMessage("Reply sent", "success");
              fetchDisputes();
            } else {
              const data = await res.json();
              displayMessage(data.message || "Failed to send reply", "error");
            }
          } catch (err) {
            displayMessage("Network error", "error");
          }
        }

        async function updateDisputeStatus(id, status) {
          try {
            const res = await fetch(
              `${BASE_URL}/api/admin/disputes/${id}/status`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify({ status }),
              },
            );
            if (res.ok) {
              displayMessage(`Dispute ${status}!`, "success");
              fetchDisputes();
            } else {
              const data = await res.json();
              displayMessage(data.message || "Failed", "error");
            }
          } catch (err) {
            displayMessage("Network error", "error");
          }
        }

        // ──────────────────────────────────────────────
