const foodCampaignEditor = document.getElementById("foodCampaignEditor");
const refreshFoodCampaignsBtn = document.getElementById(
  "refreshFoodCampaignsBtn",
);
const saveFoodCampaignsBtn = document.getElementById("saveFoodCampaignsBtn");

let latestFoodCampaigns = [];

function mealLabel(mealType) {
  return (
    {
      breakfast: "Breakfast",
      lunch: "Lunch",
      dinner: "Dinner",
    }[mealType] || mealType
  );
}

function renderFoodReadinessCampaigns(campaigns = []) {
  if (!foodCampaignEditor) return;
  latestFoodCampaigns = campaigns;

  foodCampaignEditor.innerHTML = campaigns
    .map(
      (campaign) => `
        <section class="rounded-xl bg-blue-900 bg-opacity-20 border border-cyan-400 border-opacity-10 p-5">
          <p class="text-xs uppercase tracking-[0.25em] text-accent-cyan mb-3">${escapeHtml(mealLabel(campaign.mealType))}</p>
          <label class="block text-sm font-semibold text-light-gray mb-2">Title</label>
          <input class="food-campaign-title input-field w-full mb-3" data-meal-type="${escapeHtml(campaign.mealType)}" value="${escapeHtml(campaign.title || "")}" />
          <label class="block text-sm font-semibold text-light-gray mb-2">Message</label>
          <textarea class="food-campaign-message input-field w-full mb-3" rows="3" data-meal-type="${escapeHtml(campaign.mealType)}">${escapeHtml(campaign.message || "")}</textarea>
          <label class="block text-sm font-semibold text-light-gray mb-2">City</label>
          <input class="food-campaign-city input-field w-full mb-3" data-meal-type="${escapeHtml(campaign.mealType)}" value="${escapeHtml(campaign.city || "")}" placeholder="Abuja" />
          <div class="grid gap-3 md:grid-cols-2 mb-3">
            <div>
              <label class="block text-sm font-semibold text-light-gray mb-2">Start time</label>
              <input class="food-campaign-start input-field w-full" type="time" data-meal-type="${escapeHtml(campaign.mealType)}" value="${escapeHtml(campaign.startTime || "")}" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-light-gray mb-2">End time</label>
              <input class="food-campaign-end input-field w-full" type="time" data-meal-type="${escapeHtml(campaign.mealType)}" value="${escapeHtml(campaign.endTime || "")}" />
            </div>
          </div>
          <label class="block text-sm font-semibold text-light-gray mb-2">Image URL</label>
          <input class="food-campaign-image input-field w-full mb-3" data-meal-type="${escapeHtml(campaign.mealType)}" value="${escapeHtml(campaign.imageUrl || "")}" />
          <div class="flex items-center gap-3 mb-3">
            <input class="food-campaign-file hidden" type="file" accept="image/*" data-meal-type="${escapeHtml(campaign.mealType)}" />
            <button class="upload-food-campaign-image btn btn-primary-alt px-4 py-2 text-sm" data-meal-type="${escapeHtml(campaign.mealType)}">Upload image</button>
            <label class="flex items-center gap-3 text-sm text-light-gray">
              <input class="food-campaign-active h-4 w-4" type="checkbox" data-meal-type="${escapeHtml(campaign.mealType)}" ${campaign.isActive === false ? "" : "checked"} />
              Active
            </label>
          </div>
          ${
            campaign.imageUrl
              ? `<img src="${escapeHtml(campaign.imageUrl)}" alt="${escapeHtml(campaign.title || campaign.mealType)}" class="h-36 w-full rounded-lg object-cover" />`
              : `<div class="h-36 rounded-lg border border-dashed border-cyan-400 border-opacity-20 flex items-center justify-center text-light-gray">No image uploaded</div>`
          }
        </section>
      `,
    )
    .join("");

  document.querySelectorAll(".upload-food-campaign-image").forEach((button) => {
    button.addEventListener("click", async () => {
      const mealType = button.dataset.mealType;
      const fileInput = document.querySelector(
        `.food-campaign-file[data-meal-type="${mealType}"]`,
      );
      fileInput?.click();
    });
  });

  document.querySelectorAll(".food-campaign-file").forEach((input) => {
    input.addEventListener("change", async () => {
      const mealType = input.dataset.mealType;
      const imageInput = document.querySelector(
        `.food-campaign-image[data-meal-type="${mealType}"]`,
      );
      const file = input.files?.[0];
      if (!file || !imageInput) return;
      const url = await uploadFoodCampaignImage(file);
      if (url) imageInput.value = url;
      input.value = "";
    });
  });
}

async function uploadFoodCampaignImage(file) {
  if (!adminToken) return "";

  const formData = new FormData();
  formData.append("image", file);

  try {
    const response = await fetch(
      `${BASE_URL}/api/uploads/cloudinary/food-campaign`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${adminToken}` },
        body: formData,
      },
    );
    const data = await response.json();
    if (handleAdminSessionExpiry(response.status)) return "";
    if (!response.ok) {
      throw new Error(data.message || "Image upload failed.");
    }
    displayMessage("Campaign image uploaded.", "success");
    return data.url || "";
  } catch (error) {
    displayMessage(`Upload failed: ${error.message}`, "error");
    return "";
  }
}

async function fetchFoodReadinessCampaigns() {
  if (!adminToken || !foodCampaignEditor) return;
  foodCampaignEditor.innerHTML =
    '<p class="text-light-gray">Loading campaigns...</p>';

  try {
    const response = await fetch(
      `${BASE_URL}/api/food-readiness-campaigns/admin`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    const data = await response.json();
    if (handleAdminSessionExpiry(response.status)) return;
    if (!response.ok) {
      throw new Error(data.message || "Failed to load food campaigns.");
    }
    renderFoodReadinessCampaigns(data.campaigns || []);
  } catch (error) {
    foodCampaignEditor.innerHTML = `<p class="text-red-400">${escapeHtml(error.message)}</p>`;
  }
}

async function saveFoodReadinessCampaigns() {
  if (!adminToken || !latestFoodCampaigns.length) {
    displayMessage("Refresh the campaigns first.", "warning");
    return;
  }

  const campaigns = latestFoodCampaigns.map((campaign) => {
    const mealType = campaign.mealType;
    return {
      mealType,
      title:
        document.querySelector(
          `.food-campaign-title[data-meal-type="${mealType}"]`,
        )?.value?.trim() || "",
      message:
        document.querySelector(
          `.food-campaign-message[data-meal-type="${mealType}"]`,
        )?.value?.trim() || "",
      city:
        document.querySelector(
          `.food-campaign-city[data-meal-type="${mealType}"]`,
        )?.value?.trim() || "",
      startTime:
        document.querySelector(
          `.food-campaign-start[data-meal-type="${mealType}"]`,
        )?.value || "",
      endTime:
        document.querySelector(
          `.food-campaign-end[data-meal-type="${mealType}"]`,
        )?.value || "",
      imageUrl:
        document.querySelector(
          `.food-campaign-image[data-meal-type="${mealType}"]`,
        )?.value?.trim() || "",
      isActive:
        document.querySelector(
          `.food-campaign-active[data-meal-type="${mealType}"]`,
        )?.checked === true,
    };
  });

  try {
    const response = await fetch(
      `${BASE_URL}/api/food-readiness-campaigns/admin`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ campaigns }),
      },
    );
    const data = await response.json();
    if (handleAdminSessionExpiry(response.status)) return;
    if (!response.ok) {
      throw new Error(data.message || "Failed to save food campaigns.");
    }
    renderFoodReadinessCampaigns(data.campaigns || []);
    displayMessage(data.message || "Food readiness campaigns updated.", "success");
  } catch (error) {
    displayMessage(`Save failed: ${error.message}`, "error");
  }
}

refreshFoodCampaignsBtn?.addEventListener("click", fetchFoodReadinessCampaigns);
saveFoodCampaignsBtn?.addEventListener("click", saveFoodReadinessCampaigns);

if (currentPage === "food-readiness-campaigns") {
  fetchFoodReadinessCampaigns();
}
