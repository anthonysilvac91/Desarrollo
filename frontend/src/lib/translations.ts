export type Language = "en" | "es";

export const translations = {
  en: {
    sidebar: {
      dashboard: "Dashboard",
      assets: "Assets",
      jobs: "Jobs",
      users: "Users",
      settings: "Settings",
      admin_console: "Admin Console",
    },
    topbar: {
      notifications: "Notifications",
      account_manager: "Account Manager",
      titles: {
        assets: "Assets",
        jobs: "Jobs",
        users: "Users",
        settings: "Settings",
        dashboard: "Dashboard",
      }
    },
    assets: {
      search_placeholder: "Search assets...",
      filter: "Filter",
      add_new: "Add New",
      table: {
        asset: "Asset",
        client: "Client",
        location: "Location",
        last_job: "Last Job",
        actions: "Actions",
      },
      pagination: {
        showing: "Showing",
        of: "of",
        assets: "assets",
      }
    }
  },
  es: {
    sidebar: {
      dashboard: "Panel",
      assets: "Activos",
      jobs: "Trabajos",
      users: "Usuarios",
      settings: "Configuración",
      admin_console: "Administración",
    },
    topbar: {
      notifications: "Notificaciones",
      account_manager: "Gerente de Cuenta",
      titles: {
        assets: "Activos",
        jobs: "Trabajos",
        users: "Usuarios",
        settings: "Configuración",
        dashboard: "Panel",
      }
    },
    assets: {
      search_placeholder: "Buscar activos...",
      filter: "Filtrar",
      add_new: "Añadir Nuevo",
      table: {
        asset: "Activo",
        client: "Cliente",
        location: "Ubicación",
        last_job: "Último Trabajo",
        actions: "Acciones",
      },
      pagination: {
        showing: "Mostrando",
        of: "de",
        assets: "activos",
      }
    }
  }
};
