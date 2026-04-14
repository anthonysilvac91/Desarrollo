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
      delete_user_title: "Delete user?",
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
    },
    settings: {
      tabs: {
        profile: "Company Profile",
        branding_assets: "Identity & Assets",
      },
      company_section: {
        title: "Company Profile",
        subtitle: "Manage your business public information",
        name: "Business Name",
        email: "Support Email",
        phone: "Contact Phone",
        website: "Website",
        logo: "Company Logo",
        logo_help: "JPG, PNG or SVG. Max 1MB.",
        upload_logo: "UPLOAD LOGO",
      },
      asset_section: {
        title: "Asset Defaults",
        subtitle: "Personalize the icon shown when an asset has no photo.",
        icons: {
          ship: "Ship",
          car: "Vehicle",
          house: "House",
          building: "Building",
          plane: "Aviation",
          truck: "Logistics",
          industry: "Industry",
          tools: "Workshop",
          construction: "Construction",
          tech: "Technology",
          health: "Health",
          nature: "Environment",
          corporate: "Corporate",
          leisure: "Leisure",
          camera: "Generic",
        }
      },
      branding_section: {
        palette: "Primary Color",
        subtitle: "This color is used for buttons, links and platform highlights.",
        palettes: {
          recall: "Recall Blue",
          ocean: "Ocean",
          teal: "Teal",
          forest: "Forest",
          amber: "Amber",
          orange: "Orange",
          rose: "Rose",
          pink: "Pink",
          indigo: "Indigo",
          violet: "Violet",
          slate: "Slate",
        }
      }
    },
    dashboard: {
      title: "Dashboard",
      subtitle: "Operational analysis and performance",
      kpis: {
        jobs_performed: "Jobs Performed",
        assets_serviced: "Assets Serviced",
        clients_reached: "Clients Reached",
        growth: "Growth",
        previous_period: "vs previous period",
      },
      charts: {
        evolution_title: "Service Evolution",
      },
      rankings: {
        top_assets: "Top 3 Assets",
        top_clients: "Top 3 Clients",
        top_operators: "Top 3 Operators",
        jobs_count: "serv",
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
    },
    settings: {
      tabs: {
        profile: "Perfil de Empresa",
        branding_assets: "Identidad y Activos",
      },
      company_section: {
        title: "Perfil de Empresa",
        subtitle: "Gestiona la información pública de tu negocio",
        name: "Nombre del Negocio",
        email: "Email de Soporte",
        phone: "Teléfono de Contacto",
        website: "Sitio Web",
        logo: "Logo de la Empresa",
        logo_help: "JPG, PNG o SVG. Máx 1MB.",
        upload_logo: "SUBIR LOGO",
      },
      asset_section: {
        title: "Valores por Defecto de Activos",
        subtitle: "Personaliza el icono que se muestra cuando un activo no tiene foto.",
        icons: {
          ship: "Barco",
          car: "Vehículo",
          house: "Casa",
          building: "Edificio",
          plane: "Aviación",
          truck: "Logística",
          industry: "Industria",
          tools: "Taller",
          construction: "Obra",
          tech: "Tecnología",
          health: "Salud",
          nature: "Ambiente",
          corporate: "Corporativo",
          leisure: "Ocio",
          camera: "Genérico",
        }
      },
      branding_section: {
        palette: "Color Principal",
        subtitle: "Este color se usa para botones, enlaces y aspectos destacados de toda la plataforma.",
        palettes: {
          recall: "Azul Recall",
          ocean: "Océano",
          teal: "Teal",
          forest: "Bosque",
          amber: "Ámbar",
          orange: "Naranja",
          rose: "Rosa",
          pink: "Fucsia",
          indigo: "Índigo",
          violet: "Violeta",
          slate: "Pizarra",
        }
      }
    },
    dashboard: {
      title: "Panel de Control",
      subtitle: "Análisis operacional y rendimiento",
      kpis: {
        jobs_performed: "Trabajos Realizados",
        assets_serviced: "Activos con Servicio",
        clients_reached: "Clientes Atendidos",
        growth: "Crecimiento",
        previous_period: "vs periodo anterior",
      },
      charts: {
        evolution_title: "Evolución de Servicios",
      },
      rankings: {
        top_assets: "Top 3 Activos",
        top_clients: "Top 3 Clientes",
        top_operators: "Top 3 Operadores",
        jobs_count: "serv",
      }
    }
  }
};
