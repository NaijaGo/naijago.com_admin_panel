        function renderCarouselSlideCards(slides = [], placement) {
          if (!slides.length) {
            return `<p class="text-light-gray">No ${placement === "main" ? "main" : "promo"} slides have been added yet.</p>`;
          }

          return slides
            .map(
              (slide) => `
            <div class="rounded-xl border border-cyan-400 border-opacity-15 bg-blue-950 bg-opacity-30 p-4" data-slide-id="${escapeHtml(slide._id || slide.id || "")}" data-placement="${escapeHtml(slide.placement || placement)}" data-image-url="${escapeHtml(slide.imageUrl || "")}">
                <div class="grid gap-4 lg:grid-cols-[160px_1fr]">
                    <div class="overflow-hidden rounded-xl border border-cyan-400 border-opacity-10 bg-blue-900 bg-opacity-20">
                        <img
                            src="${escapeHtml(slide.imageUrl || "")}"
                            alt="${escapeHtml(slide.title || "Carousel slide")}"
                            class="h-36 w-full object-cover"
                            loading="lazy"
                        />
                    </div>

                    <div class="space-y-4">
                        <div class="grid gap-4 md:grid-cols-2">
                            <div>
                                <label class="block text-xs font-semibold uppercase tracking-[0.2em] text-light-gray mb-2">Title</label>
                                <input type="text" class="carousel-title input-field w-full" value="${escapeHtml(slide.title || "")}" />
                            </div>
                            <div>
                                <label class="block text-xs font-semibold uppercase tracking-[0.2em] text-light-gray mb-2">Subtitle</label>
                                <input type="text" class="carousel-subtitle input-field w-full" value="${escapeHtml(slide.subtitle || "")}" />
                            </div>
                            <div class="md:col-span-2">
                                <label class="block text-xs font-semibold uppercase tracking-[0.2em] text-light-gray mb-2">Image URL</label>
                                <input type="url" class="carousel-image-url input-field w-full" value="${escapeHtml(slide.imageUrl || "")}" />
                            </div>
                            <div>
                                <label class="block text-xs font-semibold uppercase tracking-[0.2em] text-light-gray mb-2">Replace Image</label>
                                <input type="file" class="carousel-image-file block w-full text-sm text-light-gray" accept="image/*" />
                            </div>
                            <div>
                                <label class="block text-xs font-semibold uppercase tracking-[0.2em] text-light-gray mb-2">Click Action</label>
                                <select class="carousel-action-type input-field w-full">
                                  ${renderActionOptions(slide.actionType || "none")}
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold uppercase tracking-[0.2em] text-light-gray mb-2">Action Value</label>
                                <input type="text" class="carousel-action-value input-field w-full" value="${escapeHtml(slide.actionValue || "")}" />
                            </div>
                            <div>
                                <label class="block text-xs font-semibold uppercase tracking-[0.2em] text-light-gray mb-2">Fallback Link URL</label>
                                <input type="url" class="carousel-link-url input-field w-full" value="${escapeHtml(slide.linkUrl || "")}" />
                            </div>
                            <div>
                                <label class="block text-xs font-semibold uppercase tracking-[0.2em] text-light-gray mb-2">Sort Order</label>
                                <input type="number" class="carousel-sort-order input-field w-full" value="${Number(slide.sortOrder || 0)}" />
                            </div>
                        </div>

                        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div class="space-y-1">
                                <label class="flex items-center gap-3 text-sm text-light-gray">
                                    <input type="checkbox" class="carousel-is-active h-4 w-4" ${slide.isActive ? "checked" : ""} />
                                    Slide is active
                                </label>
                                <p class="text-xs text-gray-400">
                                    Updated ${formatDateTime(slide.updatedAt)} by ${escapeHtml(getAdminDisplayName(slide.updatedBy))}
                                </p>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <button type="button" class="save-carousel-slide-btn btn btn-success px-4 py-2 text-sm" data-id="${escapeHtml(slide._id || slide.id || "")}">
                                    Save
                                </button>
                                <button type="button" class="delete-carousel-slide-btn btn btn-danger px-4 py-2 text-sm" data-id="${escapeHtml(slide._id || slide.id || "")}">
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `,
            )
            .join("");
        }

        function attachCarouselSlideListeners() {
          document
            .querySelectorAll(".save-carousel-slide-btn")
            .forEach((button) => {
              button.addEventListener("click", () =>
                updateCarouselSlide(button),
              );
            });

          document
            .querySelectorAll(".delete-carousel-slide-btn")
            .forEach((button) => {
              button.addEventListener("click", () =>
                deleteCarouselSlide(button.dataset.id),
              );
            });
        }

        function renderCarouselSlides(groupedSlides = {}) {
          if (!mainCarouselSlidesList || !promoCarouselSlidesList) return;

          const mainSlides = Array.isArray(groupedSlides.main)
            ? groupedSlides.main
            : [];
          const promoSlides = Array.isArray(groupedSlides.promo)
            ? groupedSlides.promo
            : [];

          mainCarouselSlidesList.innerHTML = renderCarouselSlideCards(
            mainSlides,
            "main",
          );
          promoCarouselSlidesList.innerHTML = renderCarouselSlideCards(
            promoSlides,
            "promo",
          );
          attachCarouselSlideListeners();
          hasLoadedCarouselSlides = true;
        }

        async function uploadCarouselImage(file, placement) {
          await validateCarouselImageSize(file, placement);

          const formData = new FormData();
          formData.append("image", file);
          formData.append("placement", placement);

          const response = await fetch(
            `${BASE_URL}/api/uploads/cloudinary/carousel`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${adminToken}`,
              },
              body: formData,
            },
          );

          const data = await response.json();

          if (handleAdminSessionExpiry(response.status)) {
            throw new Error("Session expired");
          }

          if (!response.ok || !data.url) {
            throw new Error(data.message || "Failed to upload carousel image.");
          }

          return data.url;
        }

        function renderActionOptions(selected = "none") {
          const options = [
            ["none", "No action"],
            ["restaurant", "Open restaurants"],
            ["pharmacy", "Open pharmacy"],
            ["category", "Open category"],
            ["product", "Open product"],
            ["external", "Open external link"],
          ];
          return options
            .map(
              ([value, label]) =>
                `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`,
            )
            .join("");
        }

        function validateCarouselImageSize(file, placement) {
          const requirements = {
            main: { width: 1200, height: 520, label: "1200 x 520 px" },
            promo: { width: 1080, height: 360, label: "1080 x 360 px" },
          };
          const requirement = requirements[placement];
          if (!requirement || !file) return Promise.resolve();

          return new Promise((resolve, reject) => {
            const image = new Image();
            const objectUrl = URL.createObjectURL(file);

            image.onload = () => {
              URL.revokeObjectURL(objectUrl);
              if (
                image.naturalWidth < requirement.width ||
                image.naturalHeight < requirement.height
              ) {
                reject(
                  new Error(
                    `${placement === "main" ? "Top" : "Promo"} carousel image is too small. Recommended minimum is ${requirement.label}. Selected image is ${image.naturalWidth} x ${image.naturalHeight} px.`,
                  ),
                );
                return;
              }
              resolve();
            };

            image.onerror = () => {
              URL.revokeObjectURL(objectUrl);
              reject(new Error("Unable to read carousel image size."));
            };

            image.src = objectUrl;
          });
        }

        async function buildCarouselPayload(
          container,
          placement,
          existingImageUrl = "",
        ) {
          const title =
            container.querySelector(".carousel-title")?.value?.trim() || "";
          const subtitle =
            container.querySelector(".carousel-subtitle")?.value?.trim() || "";
          const imageUrlInput = container.querySelector(".carousel-image-url");
          const fileInput = container.querySelector(".carousel-image-file");
          const linkUrl =
            container.querySelector(".carousel-link-url")?.value?.trim() || "";
          const actionType =
            container.querySelector(".carousel-action-type")?.value || "none";
          const actionValue =
            container.querySelector(".carousel-action-value")?.value?.trim() ||
            "";
          const sortOrderValue = container.querySelector(
            ".carousel-sort-order",
          )?.value;
          const isActive = Boolean(
            container.querySelector(".carousel-is-active")?.checked,
          );

          let imageUrl = imageUrlInput?.value?.trim() || existingImageUrl;

          if (fileInput?.files?.length) {
            imageUrl = await uploadCarouselImage(fileInput.files[0], placement);
            if (imageUrlInput) {
              imageUrlInput.value = imageUrl;
            }
          }

          return {
            placement,
            title,
            subtitle,
            imageUrl,
            linkUrl,
            actionType,
            actionValue,
            sortOrder: Number.parseInt(sortOrderValue || "0", 10) || 0,
            isActive,
          };
        }

        async function fetchCarouselSlides() {
          if (
            !adminToken ||
            !mainCarouselSlidesList ||
            !promoCarouselSlidesList
          )
            return;

          mainCarouselSlidesList.innerHTML =
            '<p class="text-light-gray">Loading main slides...</p>';
          promoCarouselSlidesList.innerHTML =
            '<p class="text-light-gray">Loading promo slides...</p>';

          try {
            const response = await fetch(
              `${BASE_URL}/api/admin/carousel-slides`,
              {
                headers: {
                  Authorization: `Bearer ${adminToken}`,
                },
              },
            );
            const data = await response.json();

            if (handleAdminSessionExpiry(response.status)) {
              return;
            }

            if (response.ok) {
              renderCarouselSlides(data);
            } else {
              mainCarouselSlidesList.innerHTML =
                '<p class="text-red-400">Unable to load main slides.</p>';
              promoCarouselSlidesList.innerHTML =
                '<p class="text-red-400">Unable to load promo slides.</p>';
              displayMessage(
                data.message || "Failed to load carousel slides.",
                "error",
              );
            }
          } catch (err) {
            mainCarouselSlidesList.innerHTML =
              '<p class="text-red-400">Unable to load main slides.</p>';
            promoCarouselSlidesList.innerHTML =
              '<p class="text-red-400">Unable to load promo slides.</p>';
            displayMessage(`Error: ${err.message}`, "error");
          }
        }

        async function createCarouselSlide(event) {
          event.preventDefault();

          const form = event.currentTarget;
          const placement = form?.dataset?.placement;
          const submitButton = form?.querySelector('button[type="submit"]');
          const originalButtonText = submitButton?.textContent || "Save Slide";

          if (!placement) return;

          if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = "Saving...";
          }

          try {
            const payload = await buildCarouselPayload(form, placement);

            if (!payload.imageUrl) {
              displayMessage(
                "Please provide an image URL or upload an image before saving.",
                "warning",
              );
              return;
            }

            const response = await fetch(
              `${BASE_URL}/api/admin/carousel-slides`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify(payload),
              },
            );
            const data = await response.json();

            if (handleAdminSessionExpiry(response.status)) {
              return;
            }

            if (response.ok) {
              form.reset();
              const activeCheckbox = form.querySelector(".carousel-is-active");
              if (activeCheckbox) {
                activeCheckbox.checked = true;
              }
              displayMessage(
                data.message || "Carousel slide created successfully.",
                "success",
              );
              fetchCarouselSlides();
            } else {
              displayMessage(
                data.message || "Failed to create carousel slide.",
                "error",
              );
            }
          } catch (err) {
            if (err.message !== "Session expired") {
              displayMessage(`Error: ${err.message}`, "error");
            }
          } finally {
            if (submitButton) {
              submitButton.disabled = false;
              submitButton.textContent = originalButtonText;
            }
          }
        }

        async function updateCarouselSlide(button) {
          const card = button?.closest("[data-slide-id]");
          const slideId = card?.dataset?.slideId;
          const placement = card?.dataset?.placement;
          const originalButtonText = button?.textContent || "Save";

          if (!card || !slideId || !placement) return;

          button.disabled = true;
          button.textContent = "Saving...";

          try {
            const payload = await buildCarouselPayload(
              card,
              placement,
              card.dataset.imageUrl || "",
            );

            if (!payload.imageUrl) {
              displayMessage(
                "Please provide an image URL or upload an image before saving.",
                "warning",
              );
              return;
            }

            const response = await fetch(
              `${BASE_URL}/api/admin/carousel-slides/${slideId}`,
              {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify(payload),
              },
            );
            const data = await response.json();

            if (handleAdminSessionExpiry(response.status)) {
              return;
            }

            if (response.ok) {
              displayMessage(
                data.message || "Carousel slide updated successfully.",
                "success",
              );
              fetchCarouselSlides();
            } else {
              displayMessage(
                data.message || "Failed to update carousel slide.",
                "error",
              );
            }
          } catch (err) {
            if (err.message !== "Session expired") {
              displayMessage(`Error: ${err.message}`, "error");
            }
          } finally {
            button.disabled = false;
            button.textContent = originalButtonText;
          }
        }

        async function deleteCarouselSlide(slideId) {
          if (!slideId) return;
          if (!confirm("Delete this carousel slide?")) return;

          try {
            const response = await fetch(
              `${BASE_URL}/api/admin/carousel-slides/${slideId}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${adminToken}`,
                },
              },
            );
            const data = await response.json();

            if (handleAdminSessionExpiry(response.status)) {
              return;
            }

            if (response.ok) {
              displayMessage(
                data.message || "Carousel slide deleted successfully.",
                "success",
              );
              fetchCarouselSlides();
            } else {
              displayMessage(
                data.message || "Failed to delete carousel slide.",
                "error",
              );
            }
          } catch (err) {
            displayMessage(`Error: ${err.message}`, "error");
          }
        }
