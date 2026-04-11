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
        jobs: "Jobs",
        last_job: "Last Job",
        actions: "Actions",
      },
      pagination: {
        showing: "Showing",
        of: "of",
        assets: "assets",
      },
      filters: {
        clear_all: "Clear All",
        by_client: "By Client",
        by_category: "By Category",
        apply: "Apply Filters"
      },
      drawer: {
        location: "Location",
        jobs: "Jobs",
        total: "Total",
        maintenance_history: "Maintenance History",
        full_report: "Full Report",
        load_more: "Load More",
        loading: "Loading...",
        all_loaded: "All history records loaded",
        see_entire_history: "See entire history",
        photo: "Photo"
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
        jobs: "Trabajos",
        last_job: "Último Trabajo",
        actions: "Acciones",
      },
      pagination: {
        showing: "Mostrando",
        of: "de",
        assets: "activos",
      },
      filters: {
        clear_all: "Limpiar filtros",
        by_client: "Por Cliente",
        by_category: "Por Categoría",
        apply: "Aplicar Filtros"
      },
      drawer: {
        location: "Ubicación",
        jobs: "Trabajos",
        total: "Total",
        maintenance_history: "Historial de Mantenimiento",
        full_report: "Reporte Completo",
        load_more: "Cargar más",
        loading: "Cargando...",
        all_loaded: "Todos los registros cargados",
        see_entire_history: "Ver historial completo",
        photo: "Foto"
      }
    }
  }
};
