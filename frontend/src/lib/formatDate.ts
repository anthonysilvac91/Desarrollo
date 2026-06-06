export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = String(d.getDate()).padStart(2, "0");
  const year = d.getFullYear();
  return `${month}-${day}-${year}`;
}

export function formatRelativeTime(date: string | Date, lang: "en" | "es" = "en"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1)   return lang === "es" ? "Ahora mismo" : "Just now";
  if (diffMins < 60)  return lang === "es" ? `Hace ${diffMins}m` : `${diffMins}m ago`;
  if (diffHours < 24) return lang === "es" ? `Hace ${diffHours}h` : `${diffHours}h ago`;
  if (diffDays === 1) return lang === "es" ? "Ayer" : "Yesterday";
  if (diffDays < 7)   return lang === "es" ? `Hace ${diffDays}d` : `${diffDays}d ago`;

  return d.toLocaleDateString(lang === "es" ? "es" : "en-US", { month: "short", day: "numeric" });
}
