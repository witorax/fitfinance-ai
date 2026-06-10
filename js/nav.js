// Injecte la barre de navigation et verifie que l'utilisateur est connecte.
// A appeler sur toutes les pages "internes" (dashboard, sport, finance, coach).
async function requireAuthAndRenderNav(activePage) {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "index.html";
    return null;
  }

  const links = [
    { href: "dashboard.html", label: "Dashboard" },
    { href: "sport.html", label: "Sport" },
    { href: "finance.html", label: "Finance" },
    { href: "coach.html", label: "Coach IA" },
  ];

  const nav = document.createElement("div");
  nav.className = "navbar";
  nav.innerHTML = `
    <div class="brand">FitFinance AI</div>
    <nav>
      ${links.map(l => `<a href="${l.href}" class="${l.href === activePage ? "active" : ""}">${l.label}</a>`).join("")}
      <a href="#" id="logout-link">Deconnexion</a>
    </nav>
  `;
  document.body.prepend(nav);

  document.getElementById("logout-link").addEventListener("click", async (e) => {
    e.preventDefault();
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
  });

  return session;
}
