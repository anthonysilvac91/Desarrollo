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
        maintenance_history: "Service History",
        full_report: "Full Report",
        load_more: "Load More",
        loading: "Loading...",
        all_loaded: "All history records loaded",
        see_entire_history: "See entire history",
        photo: "Photo"
      },
      detail: {
        owner: "Owner",
        total_jobs: "Total Jobs",
        last_service: "Last Service",
        activity_history: "Service History",
        clear_filters: "Clear Filters",
        filter_title: "Filter History",
        responsible: "Responsible",
        all_workers: "All Operators",
        temporality: "Time Range",
        since: "Since",
        until: "Until",
        no_results: "No results matched your search",
        view_all: "View all jobs",
        export_pdf: "Export History PDF",
        today: "Today",
        week: "Week",
        month: "Month",
        year: "Year",
        see_more: "See more",
        see_less: "See less",
        days_ago: "days ago"
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
        maintenance_history: "Historial de Servicios",
        full_report: "Reporte Completo",
        load_more: "Cargar más",
        loading: "Cargando...",
        all_loaded: "Todos los registros cargados",
        see_entire_history: "Ver historial completo",
        photo: "Foto"
      },
      detail: {
        owner: "Propietario",
        total_jobs: "Total de Trabajos",
        last_service: "Último Servicio",
        activity_history: "Historial de Servicios",
        clear_filters: "Limpiar Filtros",
        filter_title: "Filtrar Historial",
        responsible: "Responsable",
        all_workers: "Todos los Operadores",
        temporality: "Temporalidad",
        since: "Desde",
        until: "Hasta",
        no_results: "Sin resultados para tu búsqueda",
        view_all: "Ver todos los trabajos",
        export_pdf: "Exportar Historial PDF",
        today: "Hoy",
        week: "Semana",
        month: "Mes",
        year: "Año",
        see_more: "Ver más",
        see_less: "Ver menos",
        days_ago: "días"
      }
    }
  }
};
