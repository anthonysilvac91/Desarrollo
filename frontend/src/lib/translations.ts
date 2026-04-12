export type Language = "en" | "es";

export const translations = {
  en: {
    sidebar: {
      dashboard: "Dashboard",
      assets: "Assets",
      services: "Services",
      users: "Users",
      settings: "Settings",
      admin_console: "Admin Console",
    },
    topbar: {
      notifications: "Notifications",
      account_manager: "Account Manager",
      titles: {
        assets: "Asset Management",
        services: "Service Records",
        users: "Users",
        settings: "Settings",
        dashboard: "Control Panel",
      }
    },
    common: {
      confirm: "Confirm",
      cancel: "Cancel",
      delete: "Delete",
      save: "Save",
      search: "Search...",
      loading: "Loading...",
      no_results: "No results.",
      active: "Active",
      inactive: "Inactive",
    },
    date_filters: {
      today: "Today",
      month: "Month",
      year: "Year",
      custom: "Custom",
      from: "From",
      to: "To",
      apply: "Apply Range",
    },
    confirm_modal: {
      delete_asset_title: "Delete asset?",
      delete_service_title: "Delete service?",
      delete_description: "This action is permanent and cannot be undone.",
      confirm_delete: "Delete",
      cancel_delete: "Cancel",
    },
    assets: {
      search_placeholder: "Search boats by name, location, client...",
      filter: "Filter",
      add_new: "Add Boat",
      table: {
        asset: "Boat",
        client: "Client",
        location: "Location",
        jobs: "Jobs",
        last_job: "Last Job",
        actions: "Actions",
      },
      pagination: {
        showing: "Showing",
        of: "of",
        assets: "registered boats",
      },
      filters: {
        clear_all: "Clear filters",
        by_client: "By Client",
        by_category: "By Category",
        apply: "Apply Filters"
      },
      drawer: {
        location: "Geographic Location",
        jobs: "Total Activity",
        total: "services performed",
        maintenance_history: "Maintenance History",
        full_report: "Full Report",
        load_more: "Load previous history",
        loading: "Consulting...",
        all_loaded: "All history shown",
        see_entire_history: "See full history",
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
        days_ago: "days"
      }
    },
    services: {
      search_placeholder: "Search services by description, boat, client...",
      filter: "Filter",
      add_new: "New Service",
      table: {
        service: "Service Performed",
        asset: "Boat / Asset",
        operator: "Operator",
        client: "Client",
        date: "Date",
        actions: "Actions",
      },
      pagination: {
        showing: "Showing",
        of: "of",
        services: "completed services",
      }
    },
    users: {
      search_placeholder: "Search users by name, role, company...",
      add_new: "Add User",
      table: {
        name: "Name",
        role: "Role",
        company: "Company",
        status: "Status",
        last_access: "Last Access",
        actions: "Actions",
      },
      modal: {
        title: "Create New User",
        full_name: "Full Name",
        email: "Corporate Email",
        company: "Company",
        role: "Assigned Role",
        password: "Password",
        submit: "Create User",
      },
      pagination: {
        showing: "Showing",
        of: "of",
        users: "registered users",
      }
    }
  },
  es: {
    sidebar: {
      dashboard: "Panel",
      assets: "Activos",
      services: "Servicios",
      users: "Usuarios",
      settings: "Configuración",
      admin_console: "Administración",
    },
    topbar: {
      notifications: "Notificaciones",
      account_manager: "Gerente de Cuenta",
      titles: {
        assets: "Gestión de Activos",
        services: "Registro de Servicios",
        users: "Gestión de Usuarios",
        settings: "Configuración",
        dashboard: "Panel de Control",
      }
    },
    common: {
      confirm: "Confirmar",
      cancel: "Cancelar",
      delete: "Eliminar",
      save: "Guardar",
      search: "Buscar...",
      loading: "Cargando...",
      no_results: "Sin resultados.",
      active: "Activo",
      inactive: "Inactivo",
    },
    date_filters: {
      today: "Hoy",
      month: "Mes",
      year: "Año",
      custom: "Personalizado",
      from: "Desde",
      to: "Hasta",
      apply: "Aplicar Rango",
    },
    confirm_modal: {
      delete_asset_title: "¿Eliminar activo?",
      delete_service_title: "¿Eliminar servicio?",
      delete_user_title: "¿Eliminar usuario?",
      delete_description: "Esta acción es permanente y no se puede deshacer.",
      confirm_delete: "Eliminar",
      cancel_delete: "Cancelar",
    },
    assets: {
      search_placeholder: "Buscar barcos por nombre, ubicación, cliente...",
      filter: "Filtrar",
      add_new: "Añadir Barco",
      table: {
        asset: "Barco",
        client: "Cliente",
        location: "Ubicación",
        jobs: "Servicios",
        last_job: "Último Servicio",
        actions: "Acciones",
      },
      pagination: {
        showing: "Mostrando",
        of: "de",
        assets: "barcos registrados",
      },
      filters: {
        clear_all: "Limpiar filtros",
        by_client: "Por Cliente",
        by_category: "Por Categoría",
        apply: "Aplicar Filtros"
      },
      drawer: {
        location: "Ubicación Geográfica",
        jobs: "Actividad Total",
        total: "servicios realizados",
        maintenance_history: "Historial de Mantenimiento",
        full_report: "Reporte Completo",
        load_more: "Cargar historial anterior",
        loading: "Consultando...",
        all_loaded: "Se muestra todo el historial",
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
    },
    services: {
      search_placeholder: "Buscar servicios por descripción, barco, cliente...",
      filter: "Filtrar",
      add_new: "Nuevo Servicio",
      table: {
        service: "Servicio Realizado",
        asset: "Barco / Activo",
        operator: "Operador",
        client: "Cliente",
        date: "Fecha",
        actions: "Acciones",
      },
      pagination: {
        showing: "Mostrando",
        of: "de",
        services: "servicios completados",
      }
    },
    users: {
      search_placeholder: "Buscar usuarios por nombre, rol, empresa...",
      add_new: "Añadir Usuario",
      table: {
        name: "Nombre",
        role: "Rol",
        company: "Empresa",
        status: "Estatus",
        last_access: "Último Acceso",
        actions: "Acciones",
      },
      modal: {
        title: "Crear Nuevo Usuario",
        full_name: "Nombre Completo",
        email: "Email Corporativo",
        company: "Empresa",
        role: "Rol asignado",
        password: "Contraseña",
        submit: "Crear Usuario",
      },
      pagination: {
        showing: "Mostrando",
        of: "de",
        users: "usuarios registrados",
      }
    }
  }
};
