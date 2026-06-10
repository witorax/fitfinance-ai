// Injecte la barre de navigation et verifie que l'utilisateur est connecte.
// A appeler sur toutes les pages "internes" (dashboard, sport, finance, coach...).

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "a l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

async function loadNotifications(userId) {
  const { data } = await supabaseClient
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  const items = data || [];
  const unread = items.filter(n => !n.read).length;

  const badge = document.getElementById("notif-badge");
  if (unread > 0) {
    badge.textContent = unread > 9 ? "9+" : unread;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }

  const dd = document.getElementById("notif-dropdown");
  dd.innerHTML = items.length
    ? items.map(n => `
        <div class="notif-item ${n.read ? "" : "notif-unread"}">
          <span>${n.message}</span>
          <span class="notif-time">${timeAgo(n.created_at)}</span>
        </div>
      `).join("")
    : `<div class="notif-item"><span class="subtitle" style="margin:0;">Aucune notification pour le moment.</span></div>`;
}

async function requireAuthAndRenderNav(activePage) {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "index.html";
    return null;
  }

  const userId = session.user.id;

  const links = [
    { href: "dashboard.html", label: "Dashboard" },
    { href: "sport.html", label: "Sport" },
    { href: "nutrition.html", label: "Nutrition" },
    { href: "finance.html", label: "Finance" },
    { href: "relations.html", label: "Relations" },
    { href: "calendar.html", label: "Calendrier" },
    { href: "coach.html", label: "Aiden" },
  ];

  const nav = document.createElement("div");
  nav.className = "navbar";
  nav.innerHTML = `
    <div class="navbar-left">
      <button type="button" class="nav-bell" id="notif-bell" aria-label="Notifications">
        🔔<span class="notif-badge" id="notif-badge" style="display:none;"></span>
      </button>
      <div class="notif-dropdown" id="notif-dropdown"></div>
      <div class="brand">FitFinance AI</div>
    </div>
    <nav>
      ${links.map(l => `<a href="${l.href}" class="${l.href === activePage ? "active" : ""}">${l.label}</a>`).join("")}
      <a href="profile.html" class="navbar-profile ${activePage === "profile.html" ? "active" : ""}">
        <img id="navbar-avatar" class="navbar-avatar" style="display:none;" />
        <span id="navbar-name">Profil</span>
      </a>
      <a href="#" id="logout-link">Deconnexion</a>
    </nav>
  `;
  document.body.prepend(nav);

  document.getElementById("logout-link").addEventListener("click", async (e) => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
  });

  // ── Profil (avatar + nom) ──
  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (profile) {
    document.getElementById("navbar-name").textContent = profile.full_name || "Profil";
    if (profile.avatar_url) {
      const img = document.getElementById("navbar-avatar");
      img.src = profile.avatar_url;
      img.style.display = "inline-block";
    }
  }

  // ── Notifications ──
  await loadNotifications(userId);

  const bell = document.getElementById("notif-bell");
  const dropdown = document.getElementById("notif-dropdown");

  bell.addEventListener("click", async (e) => {
    e.stopPropagation();
    const opening = !dropdown.classList.contains("open");
    dropdown.classList.toggle("open");
    if (opening) {
      const unread = document.getElementById("notif-badge").style.display !== "none";
      if (unread) {
        await supabaseClient.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
        document.getElementById("notif-badge").style.display = "none";
        document.querySelectorAll(".notif-item.notif-unread").forEach(el => el.classList.remove("notif-unread"));
      }
    }
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target) && e.target !== bell) {
      dropdown.classList.remove("open");
    }
  });

  return session;
}
