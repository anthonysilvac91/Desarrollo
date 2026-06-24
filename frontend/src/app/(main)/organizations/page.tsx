"use client";

import React, { useState, useMemo } from "react";
import { Plus, Building2, Globe, ToggleLeft, ToggleRight, Loader2, ChevronLeft, ChevronRight, Bell, Settings2 } from "lucide-react";
import FiltersBar from "@/components/ui/FiltersBar";
import DataTable, { ColumnDef } from "@/components/ui/DataTable";
import Modal from "@/components/ui/Modal";
import OrganizationForm from "@/components/master/OrganizationForm";
import PlanManagementDrawer from "@/components/subscriptions/PlanManagementDrawer";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { useQuery } from "@tanstack/react-query";
import { organizationsService, Organization } from "@/services/organizations.service";
import { subscriptionsService, SubscriptionWithUsage } from "@/services/subscriptions.service";
import { useDebounce } from "@/hooks/useDebounce";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

const PLAN_BADGE: Record<string, string> = {
  DEMO: "bg-amber-100 text-amber-700 border-amber-200",
  STARTER: "bg-slate-100 text-slate-600 border-slate-200",
  PRO: "bg-blue-100 text-blue-600 border-blue-200",
  BUSINESS: "bg-emerald-100 text-emerald-600 border-emerald-200",
  ENTERPRISE: "bg-violet-100 text-violet-600 border-violet-200",
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700 border-green-200",
  TRIALING: "bg-green-100 text-green-700 border-green-200",
  SUSPENDED: "bg-red-100 text-red-700 border-red-200",
  CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
};

type OrgWithSub = Organization & {
  sub?: SubscriptionWithUsage;
};

export default function OrganizationsPage() {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [activeSortKey, setActiveSortKey] = useState<string | null>(null);
  const [drawerData, setDrawerData] = useState<SubscriptionWithUsage | null>(null);
  const [drawerOrg, setDrawerOrg] = useState<{ id: string; name: string; slug: string; is_active: boolean } | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { data: organizations = [], isLoading, refetch } = useQuery({
    queryKey: ["organizations"],
    queryFn: () => organizationsService.findAll(),
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ["subscriptions-all"],
    queryFn: () => subscriptionsService.listAll(),
  });

  const subMap = useMemo(() => {
    const map = new Map<string, SubscriptionWithUsage>();
    for (const s of subscriptions) {
      map.set(s.organization.id, s);
    }
    return map;
  }, [subscriptions]);

  const merged: OrgWithSub[] = useMemo(
    () => organizations.map((o) => ({ ...o, sub: subMap.get(o.id) })),
    [organizations, subMap],
  );

  const filtered = useMemo(() => {
    if (!debouncedSearch) return merged;
    const q = debouncedSearch.toLowerCase();
    return merged.filter(o => o.name.toLowerCase().includes(q) || o.slug?.toLowerCase().includes(q));
  }, [merged, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const safePage = Math.min(page, totalPages);
  const pageData = filtered.slice((safePage - 1) * limit, safePage * limit);

  const handleToggleStatus = async (org: Organization) => {
    try {
      await organizationsService.toggleStatus(org.id, !org.is_active);
      showToast(
        org.is_active ? t.organizations.states.toggle_success_inactive : t.organizations.states.toggle_success_active,
        "success"
      );
      refetch();
    } catch {
      showToast(t.organizations.states.toggle_error, "error");
    }
  };

  const openDrawer = (org: OrgWithSub) => {
    setDrawerData(org.sub ?? null);
    setDrawerOrg({ id: org.id, name: org.name, slug: org.slug ?? "", is_active: org.is_active });
    setIsDrawerOpen(true);
  };

  const columns: ColumnDef<OrgWithSub>[] = [
    {
      key: "name",
      header: t.sidebar.organizations.toUpperCase(),
      sortable: true,
      sortValue: (org) => org.name,
      cell: (org) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-brand/5 flex items-center justify-center shrink-0 overflow-hidden">
            {org.logo_url ? (
              <img src={org.logo_url} alt={org.name} className="w-full h-full object-contain p-2" loading="lazy" />
            ) : (
              <Building2 className="w-5 h-5 text-brand" />
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm text-title">{org.name}</span>
            {org.slug && (
              <span className="text-xs text-subtitle/40 font-bold uppercase tracking-wider flex items-center gap-1">
                <Globe className="w-2.5 h-2.5" />
                {org.slug}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "plan",
      header: "PLAN",
      sortable: true,
      sortValue: (org) => org.sub?.subscription.plan ?? "",
      cell: (org) => {
        const plan = org.sub?.subscription.plan;
        if (!plan) return <span className="text-xs text-subtitle/30">—</span>;
        return (
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${PLAN_BADGE[plan] ?? ""}`}>
              {plan}
            </span>
            {org.sub?.subscription.pending_plan && (
              <span title={`Solicitud de cambio a ${org.sub.subscription.pending_plan}`}>
                <Bell className="w-4 h-4 text-amber-500" />
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "sub_status",
      header: "ESTADO",
      sortable: true,
      sortValue: (org) => org.sub?.subscription.status ?? "",
      cell: (org) => {
        const status = org.sub?.subscription.status;
        if (!status) return <span className="text-xs text-subtitle/30">—</span>;

        const sub = org.sub!.subscription;
        const demoExpires = sub.demo_expires_at ? new Date(sub.demo_expires_at) : null;
        const daysLeft = demoExpires ? Math.ceil((demoExpires.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

        return (
          <div className="flex flex-col gap-1">
            <span className={`inline-flex w-fit px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${STATUS_BADGE[status] ?? ""}`}>
              {status}
            </span>
            {sub.plan === "DEMO" && daysLeft !== null && daysLeft > 0 && (
              <span className={`text-[10px] font-bold ${daysLeft <= 3 ? "text-red-500" : "text-subtitle/40"}`}>
                Vence en {daysLeft}d
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (org) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); openDrawer(org); }}
            className={`p-2 rounded-xl transition-all ${org.sub ? "text-subtitle/40 hover:text-brand hover:bg-brand/10" : "text-amber-500 hover:text-amber-600 hover:bg-amber-50"}`}
            title={org.sub ? "Gestionar plan" : "Asignar plan"}
          >
            <Settings2 className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleStatus(org); }}
            className={`p-2 rounded-xl transition-all ${
              org.is_active
                ? "text-brand hover:bg-brand/10"
                : "text-subtitle/30 hover:text-subtitle hover:bg-subtitle/10"
            }`}
            title={org.is_active ? "Desactivar" : "Activar"}
          >
            {org.is_active ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col space-y-8">
      <FiltersBar
        searchPlaceholder={t.organizations.search_placeholder}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        showQuickFilters={false}
        hasExternalFilter={!!activeSortKey}
        onClearAll={() => { setResetKey(k => k + 1); setActiveSortKey(null); }}
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-3 bg-brand hover:bg-brand/90 active:scale-95 text-white px-8 py-3.5 rounded-full text-base font-black transition-all shadow-lg shadow-brand/25"
          >
            <Plus className="w-5 h-5 stroke-[4px]" />
            <span>{t.organizations.add_new}</span>
          </button>
        }
      />

      <div className="bg-white rounded-4xl border border-border-theme/40 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand mb-4" />
            <p className="text-subtitle font-medium animate-pulse">{t.organizations.states.loading}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-10 h-10 text-subtitle/30" />
            </div>
            <h3 className="text-lg font-black text-title mb-1">{t.organizations.states.empty_title}</h3>
            <p className="text-subtitle font-medium max-w-sm">{t.organizations.states.empty_subtitle}</p>
          </div>
        ) : (
          <DataTable
            data={pageData}
            columns={columns}
            keyExtractor={(org) => org.id}
            onSortChange={setActiveSortKey}
            resetSortTrigger={resetKey}
            footer={
              <>
                <div className="flex items-center space-x-3">
                  <div className="text-[15px] text-subtitle font-medium tracking-tight">
                    {t.organizations.pagination.showing} <span className="text-title font-bold">{pageData.length}</span> {t.organizations.pagination.of} <span className="text-title font-bold">{filtered.length}</span> {t.organizations.pagination.organizations}
                  </div>
                  <select
                    value={limit}
                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                    className="text-xs font-bold text-subtitle border border-border-theme/40 rounded-lg px-2 py-1 bg-app-bg focus:outline-none focus:ring-2 focus:ring-brand/20"
                  >
                    {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n} / pág</option>)}
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20 flex items-center justify-center"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button className="w-9 h-9 flex items-center justify-center rounded-full bg-brand text-white text-xs font-black shadow-md shadow-brand/20">
                    {safePage}
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="p-2 rounded-md hover:bg-app-bg text-subtitle transition-colors disabled:opacity-20 flex items-center justify-center"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </>
            }
          />
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t.organizations.modal_title}
      >
        <OrganizationForm
          onSuccess={() => {
            setIsModalOpen(false);
            refetch();
          }}
        />
      </Modal>

      <PlanManagementDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        data={drawerData}
        organization={drawerOrg}
      />
    </div>
  );
}
