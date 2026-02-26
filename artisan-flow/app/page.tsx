"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Plus, Download, Trash2, FileText, AlertCircle, LogOut, UserRound, History, Users, MapPin, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { InvoicePDF } from '@/components/InvoicePDF';

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
  { ssr: false, loading: () => <div className="animate-pulse h-12 bg-gray-200 rounded-xl" /> }
);

const InvoiceMap = dynamic(
  () => import('@/components/InvoiceMap').then((mod) => mod.InvoiceMap),
  { ssr: false, loading: () => <div className="animate-pulse h-[560px] bg-gray-100 rounded-2xl border border-gray-200" /> }
);

interface Item {
  id: string;
  designation: string;
  prix: number;
  qty: number;
}

interface AuthUser {
  id: string;
  companyName: string;
  siret: string;
  email: string;
}

interface ClientRecord {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  createdAt: string;
  invoiceCount: number;
  lastInvoiceAt: string | null;
}

interface InvoiceRecord {
  id: string;
  userId: string;
  clientId: string;
  clientName: string;
  items: Item[];
  total: number;
  negotiatedTotal?: number;
  negotiationNote?: string;
  quoteNumber: string;
  issueDate: string;
  status: 'sent' | 'accepted' | 'rejected';
  documentType: 'quote' | 'invoice';
  sourceQuoteId?: string;
  paymentStatus?: 'unpaid' | 'partial' | 'paid';
  paidAmount?: number;
  paidDate?: string;
  locationAddress?: string;
  locationLat?: number;
  locationLng?: number;
  signatureName?: string;
  createdAt: string;
}

interface AddressSuggestion {
  label: string;
  postcode: string;
  city: string;
  lat: number;
  lng: number;
}

type AuthMode = 'login' | 'register';
type ActiveTab = 'home' | 'analytics' | 'quote' | 'history' | 'invoices' | 'clients' | 'map' | 'profile';

export default function CreateInvoice() {
  const [isClient, setIsClient] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [clientName, setClientName] = useState('');
  const [quoteSignatureName, setQuoteSignatureName] = useState('');
  const [quoteLocation, setQuoteLocation] = useState('');
  const [quoteLocationLat, setQuoteLocationLat] = useState<number | null>(null);
  const [quoteLocationLng, setQuoteLocationLng] = useState<number | null>(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [siret, setSiret] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [dashboardError, setDashboardError] = useState('');
  const [dashboardSuccess, setDashboardSuccess] = useState('');
  const [quoteNumber, setQuoteNumber] = useState('0000');
  const [issueDate, setIssueDate] = useState('');
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);

  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');

  const [profileCompanyName, setProfileCompanyName] = useState('');
  const [profileSiret, setProfileSiret] = useState('');
  const [profilePassword, setProfilePassword] = useState('');

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [isSavingInvoice, setIsSavingInvoice] = useState(false);
  const [isConvertingToInvoice, setIsConvertingToInvoice] = useState('');
  const [isCreatingRevisionForQuoteId, setIsCreatingRevisionForQuoteId] = useState('');
  const [deletingClientId, setDeletingClientId] = useState('');
  const [deletingInvoiceId, setDeletingInvoiceId] = useState('');
  const [updatingInvoiceId, setUpdatingInvoiceId] = useState('');
  const [updatingPaymentInvoiceId, setUpdatingPaymentInvoiceId] = useState('');
  const [isExportingInvoicesCsv, setIsExportingInvoicesCsv] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'sent' | 'accepted' | 'rejected'>('all');
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [isAddressSuggestionsLoading, setIsAddressSuggestionsLoading] = useState(false);

  const resetQuoteMeta = useCallback(() => {
    setIssueDate(new Intl.DateTimeFormat('fr-FR').format(new Date()));
    setQuoteNumber(String(Math.floor(Math.random() * 9000) + 1000));
  }, []);

  const resetDashboardMessages = useCallback(() => {
    setDashboardError('');
    setDashboardSuccess('');
  }, []);

  const loadDashboardData = useCallback(async () => {
    setIsDataLoading(true);

    try {
      const [clientsResponse, invoicesResponse] = await Promise.all([
        fetch('/api/clients', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/invoices', { credentials: 'include', cache: 'no-store' }),
      ]);

      if (clientsResponse.ok) {
        const result = await clientsResponse.json();
        setClients(Array.isArray(result.clients) ? result.clients : []);
      }

      if (invoicesResponse.ok) {
        const result = await invoicesResponse.json();
        setInvoices(Array.isArray(result.invoices) ? result.invoices : []);
      }
    } catch {
      setDashboardError('Impossible de charger les données du tableau de bord.');
    } finally {
      setIsDataLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsClient(true);
    resetQuoteMeta();
    setItems([{ id: crypto.randomUUID(), designation: '', prix: 0, qty: 1 }]);

    const bootstrapSession = async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (!response.ok) {
          setCurrentUser(null);
          return;
        }

        const result = await response.json();
        setCurrentUser(result.user ?? null);
      } catch {
        setCurrentUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    bootstrapSession();
  }, [resetQuoteMeta]);

  useEffect(() => {
    if (!currentUser) return;

    setProfileCompanyName(currentUser.companyName);
    setProfileSiret(currentUser.siret || '');
    loadDashboardData();
  }, [currentUser, loadDashboardData]);

  useEffect(() => {
    if (activeTab !== 'quote') {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }

    const query = quoteLocation.trim();

    if (!showAddressSuggestions || query.length < 3) {
      setAddressSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setIsAddressSuggestionsLoading(true);

        const response = await fetch(`/api/geocode/suggest?query=${encodeURIComponent(query)}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          setAddressSuggestions([]);
          return;
        }

        const result = await response.json();
        setAddressSuggestions(Array.isArray(result.suggestions) ? result.suggestions : []);
      } catch {
        setAddressSuggestions([]);
      } finally {
        setIsAddressSuggestionsLoading(false);
      }
    }, 280);

    return () => clearTimeout(timeout);
  }, [activeTab, quoteLocation, showAddressSuggestions]);

  const addItem = useCallback(() => {
    setItems(prev => [...prev, { 
      id: crypto.randomUUID(), 
      designation: '', 
      prix: 0, 
      qty: 1 
    }]);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => {
      const newItems = prev.filter(item => item.id !== id);
      // Garder au moins un item
      return newItems.length > 0 ? newItems : [{ id: crypto.randomUUID(), designation: '', prix: 0, qty: 1 }];
    });
  }, []);

  const updateItem = useCallback((id: string, field: keyof Item, value: string | number) => {
    setItems(prev => prev.map(item => 
      item.id === id 
        ? { ...item, [field]: field === 'prix' || field === 'qty' ? parseFloat(value as string) || 0 : value }
        : item
    ));
  }, []);

  const total = useMemo(() => 
    items.reduce((acc, item) => acc + (item.prix * item.qty), 0)
  , [items]);

  const hasValidData = useMemo(() => 
    clientName.trim() && items.some(item => item.designation.trim())
  , [clientName, items]);

  const sanitizedClientName = useMemo(() =>
    clientName.replace(/[^a-zA-Z0-9]/g, '_') || 'client'
  , [clientName]);

  const invoicesByClient = useMemo(() => {
    return invoices.reduce<Record<string, InvoiceRecord[]>>((accumulator, invoice) => {
      if (!invoice.clientId) return accumulator;

      if (!accumulator[invoice.clientId]) {
        accumulator[invoice.clientId] = [];
      }

      accumulator[invoice.clientId].push(invoice);
      return accumulator;
    }, {});
  }, [invoices]);

  const quoteDocuments = useMemo(
    () => invoices.filter((invoice) => invoice.documentType === 'quote'),
    [invoices]
  );

  const invoiceDocuments = useMemo(
    () => invoices.filter((invoice) => invoice.documentType === 'invoice'),
    [invoices]
  );

  const convertedQuoteIds = useMemo(() => {
    return new Set(
      invoiceDocuments
        .map((invoice) => invoice.sourceQuoteId)
        .filter((sourceQuoteId): sourceQuoteId is string => Boolean(sourceQuoteId))
    );
  }, [invoiceDocuments]);

  const filteredInvoices = useMemo(() => {
    const query = `${globalSearch} ${historySearch}`.trim().toLowerCase();

    return quoteDocuments.filter((invoice) => {
      const matchesStatus = historyStatusFilter === 'all' || invoice.status === historyStatusFilter;
      const matchesQuery = !query
        || invoice.clientName.toLowerCase().includes(query)
        || invoice.quoteNumber.toLowerCase().includes(query);

      return matchesStatus && matchesQuery;
    });
  }, [globalSearch, historySearch, historyStatusFilter, quoteDocuments]);

  const groupedQuoteFamilies = useMemo(() => {
    const groups = new Map<string, InvoiceRecord[]>();

    for (const quote of filteredInvoices) {
      const rootId = quote.sourceQuoteId || quote.id;
      const existing = groups.get(rootId) || [];
      existing.push(quote);
      groups.set(rootId, existing);
    }

    return Array.from(groups.values())
      .map((versions) => versions.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)))
      .sort((a, b) => {
        const aLast = a[a.length - 1]?.createdAt || '';
        const bLast = b[b.length - 1]?.createdAt || '';
        return aLast < bLast ? 1 : -1;
      });
  }, [filteredInvoices]);

  const quoteStats = useMemo(() => {
    const sent = quoteDocuments.filter((invoice) => invoice.status === 'sent').length;
    const accepted = quoteDocuments.filter((invoice) => invoice.status === 'accepted').length;
    const rejected = quoteDocuments.filter((invoice) => invoice.status === 'rejected').length;

    return {
      total: quoteDocuments.length,
      sent,
      accepted,
      rejected,
    };
  }, [quoteDocuments]);

  const invoiceStats = useMemo(() => {
    const unpaid = invoiceDocuments.filter((invoice) => (invoice.paymentStatus || 'unpaid') === 'unpaid').length;
    const partial = invoiceDocuments.filter((invoice) => invoice.paymentStatus === 'partial').length;
    const paid = invoiceDocuments.filter((invoice) => invoice.paymentStatus === 'paid').length;

    return {
      total: invoiceDocuments.length,
      unpaid,
      partial,
      paid,
    };
  }, [invoiceDocuments]);

  const financialStats = useMemo(() => {
    const totalInvoiced = invoiceDocuments.reduce((accumulator, invoice) => accumulator + invoice.total, 0);
    const totalCollected = invoiceDocuments.reduce((accumulator, invoice) => {
      if (invoice.paymentStatus === 'paid') {
        return accumulator + invoice.total;
      }

      if (invoice.paymentStatus === 'partial') {
        return accumulator + Math.min(invoice.total, Math.max(0, invoice.paidAmount ?? 0));
      }

      return accumulator;
    }, 0);

    return {
      totalInvoiced,
      totalCollected,
      remainingToCollect: Math.max(0, totalInvoiced - totalCollected),
    };
  }, [invoiceDocuments]);

  const invoiceDueInsights = useMemo(() => {
    const dayInMs = 24 * 60 * 60 * 1000;
    const parseFrDate = (value: string): Date | null => {
      const [day, month, year] = value.split('/').map(Number);

      if (!day || !month || !year) {
        return null;
      }

      const parsedDate = new Date(year, month - 1, day);
      return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    };

    const now = new Date();

    const overdueInvoices = invoiceDocuments
      .filter((invoice) => (invoice.paymentStatus || 'unpaid') !== 'paid')
      .map((invoice) => {
        const issueDate = parseFrDate(invoice.issueDate);

        if (!issueDate) {
          return null;
        }

        const dueDate = new Date(issueDate);
        dueDate.setDate(dueDate.getDate() + 30);

        const daysLate = Math.floor((now.getTime() - dueDate.getTime()) / dayInMs);

        return {
          id: invoice.id,
          quoteNumber: invoice.quoteNumber,
          clientName: invoice.clientName,
          dueDateLabel: new Intl.DateTimeFormat('fr-FR').format(dueDate),
          daysLate,
          amount: Math.max(0, invoice.total - Math.min(invoice.total, Math.max(0, invoice.paidAmount ?? 0))),
        };
      })
      .filter((entry): entry is { id: string; quoteNumber: string; clientName: string; dueDateLabel: string; daysLate: number; amount: number } => Boolean(entry))
      .filter((entry) => entry.daysLate > 0)
      .sort((a, b) => b.daysLate - a.daysLate);

    return {
      overdueCount: overdueInvoices.length,
      overdueInvoices: overdueInvoices.slice(0, 5),
    };
  }, [invoiceDocuments]);

  const monthlyRevenueData = useMemo(() => {
    const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
    const now = new Date();
    const monthBuckets = Array.from({ length: 6 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: `${monthDate.getFullYear()}-${monthDate.getMonth()}`,
        label: monthFormatter.format(monthDate),
        billed: 0,
        collected: 0,
      };
    });

    const monthMap = new Map(monthBuckets.map((month) => [month.key, month]));

    for (const invoice of invoiceDocuments) {
      const referenceDate = new Date(invoice.createdAt);

      if (Number.isNaN(referenceDate.getTime())) {
        continue;
      }

      const key = `${referenceDate.getFullYear()}-${referenceDate.getMonth()}`;
      const bucket = monthMap.get(key);

      if (!bucket) {
        continue;
      }

      bucket.billed += invoice.total;

      if (invoice.paymentStatus === 'paid') {
        bucket.collected += invoice.total;
      } else if (invoice.paymentStatus === 'partial') {
        bucket.collected += Math.min(invoice.total, Math.max(0, invoice.paidAmount ?? 0));
      }
    }

    return monthBuckets;
  }, [invoiceDocuments]);

  const quoteStatusPieData = useMemo(() => {
    return [
      { name: 'En attente', value: quoteStats.sent, color: '#3b82f6' },
      { name: 'Acceptés', value: quoteStats.accepted, color: '#10b981' },
      { name: 'Refusés', value: quoteStats.rejected, color: '#ef4444' },
    ].filter((entry) => entry.value > 0);
  }, [quoteStats]);

  const invoiceStatusPieData = useMemo(() => {
    return [
      { name: 'À payer', value: invoiceStats.unpaid, color: '#3b82f6' },
      { name: 'Partiellement payées', value: invoiceStats.partial, color: '#f59e0b' },
      { name: 'Payées', value: invoiceStats.paid, color: '#10b981' },
    ].filter((entry) => entry.value > 0);
  }, [invoiceStats]);

  const filteredInvoiceDocuments = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();

    return invoiceDocuments.filter((invoice) => {
      if (!query) return true;

      return (
        invoice.clientName.toLowerCase().includes(query)
        || invoice.quoteNumber.toLowerCase().includes(query)
      );
    });
  }, [globalSearch, invoiceDocuments]);

  const filteredClients = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();

    if (!query) {
      return clients;
    }

    return clients.filter((client) => {
      return (
        client.name.toLowerCase().includes(query)
        || client.email.toLowerCase().includes(query)
        || client.phone.toLowerCase().includes(query)
      );
    });
  }, [clients, globalSearch]);

  const getStatusLabel = useCallback((status: InvoiceRecord['status']) => {
    if (status === 'sent') return 'Envoyé';
    if (status === 'accepted') return 'Accepté';
    return 'Refusé';
  }, []);

  const getStatusBadgeClass = useCallback((status: InvoiceRecord['status']) => {
    if (status === 'sent') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (status === 'accepted') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-red-100 text-red-700 border-red-200';
  }, []);

  const getPaymentStatusLabel = useCallback((paymentStatus?: InvoiceRecord['paymentStatus']) => {
    if (paymentStatus === 'paid') return 'Payée';
    if (paymentStatus === 'partial') return 'Partiellement payée';
    return 'À payer';
  }, []);

  const getPaymentStatusBadgeClass = useCallback((paymentStatus?: InvoiceRecord['paymentStatus']) => {
    if (paymentStatus === 'paid') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (paymentStatus === 'partial') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  }, []);

  const handleDownload = useCallback(() => {
    if (!hasValidData) {
      alert('Veuillez remplir au moins le nom du client et une désignation.');
      return false;
    }

    const runSave = async () => {
      if (isSavingInvoice) return;

      try {
        setIsSavingInvoice(true);

        const response = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            clientName: clientName.trim(),
            signatureName: quoteSignatureName.trim(),
            clientId: selectedClientId,
            locationAddress: quoteLocation.trim(),
            locationLat: quoteLocationLat,
            locationLng: quoteLocationLng,
            items: items.filter((item) => item.designation.trim()),
            quoteNumber,
            issueDate,
          }),
        });

        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          setDashboardError(result.error || 'Impossible d\'enregistrer ce devis dans l\'historique.');
          return;
        }

        await loadDashboardData();
        resetQuoteMeta();
        setQuoteSignatureName('');
      } catch {
        setDashboardError('Erreur réseau pendant la sauvegarde du devis.');
      } finally {
        setIsSavingInvoice(false);
      }
    };

    runSave();
    return true;
  }, [
    clientName,
    hasValidData,
    isSavingInvoice,
    issueDate,
    items,
    loadDashboardData,
    quoteNumber,
    quoteSignatureName,
    quoteLocation,
    quoteLocationLat,
    quoteLocationLng,
    resetQuoteMeta,
    selectedClientId,
  ]);

  const resetAuthMessages = useCallback(() => {
    setAuthError('');
    setAuthSuccess('');
  }, []);

  const handleRegister = useCallback(() => {
    resetAuthMessages();

    const runRegister = async () => {
      const normalizedCompany = companyName.trim();
      const normalizedSiret = siret.trim();
      const normalizedEmail = email.trim().toLowerCase();

      if (!normalizedCompany || !normalizedEmail || !password.trim()) {
        setAuthError('Veuillez remplir tous les champs obligatoires.');
        return;
      }

      if (password.trim().length < 8) {
        setAuthError('Le mot de passe doit contenir au moins 8 caractères.');
        return;
      }

      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            companyName: normalizedCompany,
            siret: normalizedSiret,
            email: normalizedEmail,
            password: password.trim(),
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          setAuthError(result.error || 'Inscription impossible.');
          return;
        }

        setCurrentUser(result.user);
        setPassword('');
        setAuthSuccess('Compte créé et connecté avec succès.');
      } catch {
        setAuthError('Impossible de contacter le serveur.');
      }
    };

    runRegister();
  }, [companyName, siret, email, password, resetAuthMessages]);

  const handleLogin = useCallback(() => {
    resetAuthMessages();

    const runLogin = async () => {
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPassword = password.trim();

      if (!normalizedEmail || !normalizedPassword) {
        setAuthError('Veuillez renseigner email et mot de passe.');
        return;
      }

      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email: normalizedEmail,
            password: normalizedPassword,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          setAuthError(result.error || 'Connexion impossible.');
          return;
        }

        setCurrentUser(result.user);
        setPassword('');
        setAuthSuccess('Connexion réussie.');
      } catch {
        setAuthError('Impossible de contacter le serveur.');
      }
    };

    runLogin();
  }, [email, password, resetAuthMessages]);

  const handleLogout = useCallback(() => {
    const runLogout = async () => {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
        });
      } finally {
        setCurrentUser(null);
        setClientName('');
        setQuoteSignatureName('');
        setQuoteLocation('');
        setQuoteLocationLat(null);
        setQuoteLocationLng(null);
        setSelectedClientId('');
        setItems([{ id: crypto.randomUUID(), designation: '', prix: 0, qty: 1 }]);
        setAuthMode('login');
        setActiveTab('home');
        setClients([]);
        setInvoices([]);
        resetAuthMessages();
        resetDashboardMessages();
      }
    };

    runLogout();
  }, [resetAuthMessages, resetDashboardMessages]);

  const handleSelectClientForQuote = useCallback((clientId: string) => {
    setSelectedClientId(clientId);

    const selectedClient = clients.find((client) => client.id === clientId);
    if (selectedClient) {
      setClientName(selectedClient.name);
    }
  }, [clients]);

  const handleCreateClient = useCallback(() => {
    resetDashboardMessages();

    const runCreateClient = async () => {
      const name = newClientName.trim();

      if (!name) {
        setDashboardError('Le nom client est obligatoire.');
        return;
      }

      try {
        setIsCreatingClient(true);

        const response = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name,
            email: newClientEmail,
            phone: newClientPhone,
            notes: newClientNotes,
          }),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          setDashboardError(result.error || 'Impossible de créer le client.');
          return;
        }

        setDashboardSuccess('Client ajouté avec succès.');
        setNewClientName('');
        setNewClientEmail('');
        setNewClientPhone('');
        setNewClientNotes('');
        await loadDashboardData();
      } catch {
        setDashboardError('Erreur réseau pendant la création du client.');
      } finally {
        setIsCreatingClient(false);
      }
    };

    runCreateClient();
  }, [loadDashboardData, newClientEmail, newClientName, newClientNotes, newClientPhone, resetDashboardMessages]);

  const handleDeleteClient = useCallback((client: ClientRecord) => {
    resetDashboardMessages();

    const confirmed = window.confirm(
      `Supprimer le client "${client.name}" ? Cette action supprimera aussi son historique de devis.`
    );

    if (!confirmed) {
      return;
    }

    const runDeleteClient = async () => {
      try {
        setDeletingClientId(client.id);

        const response = await fetch(`/api/clients/${client.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          setDashboardError(result.error || 'Impossible de supprimer ce client.');
          return;
        }

        if (selectedClientId === client.id) {
          setSelectedClientId('');
          setClientName('');
        }

        setDashboardSuccess('Client supprimé avec succès.');
        await loadDashboardData();
      } catch {
        setDashboardError('Erreur réseau pendant la suppression du client.');
      } finally {
        setDeletingClientId('');
      }
    };

    runDeleteClient();
  }, [loadDashboardData, resetDashboardMessages, selectedClientId]);

  const handleUpdateInvoiceStatus = useCallback((invoiceId: string, status: InvoiceRecord['status']) => {
    resetDashboardMessages();

    const runUpdate = async () => {
      try {
        setUpdatingInvoiceId(invoiceId);

        const response = await fetch(`/api/invoices/${invoiceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status }),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          setDashboardError(result.error || 'Impossible de mettre à jour le statut du devis.');
          return;
        }

        if (result.convertedToInvoice) {
          setDashboardSuccess('Devis accepté et converti automatiquement en facture.');
        } else if (result.convertedInvoiceAlreadyExists) {
          setDashboardSuccess('Devis accepté. Une facture existait déjà pour ce devis.');
        }

        await loadDashboardData();
      } catch {
        setDashboardError('Erreur réseau pendant la mise à jour du statut.');
      } finally {
        setUpdatingInvoiceId('');
      }
    };

    runUpdate();
  }, [loadDashboardData, resetDashboardMessages]);

  const handleUpdateInvoicePaymentStatus = useCallback((invoice: InvoiceRecord, nextPaymentStatus: 'unpaid' | 'partial' | 'paid') => {
    resetDashboardMessages();

    let nextPaidAmount = invoice.paidAmount ?? 0;

    if (nextPaymentStatus === 'unpaid') {
      nextPaidAmount = 0;
    } else if (nextPaymentStatus === 'paid') {
      nextPaidAmount = invoice.total;
    } else {
      const defaultPartial = invoice.paidAmount && invoice.paidAmount > 0 && invoice.paidAmount < invoice.total
        ? invoice.paidAmount
        : Math.max(0.01, invoice.total / 2);

      const promptValue = window.prompt(
        'Montant encaissé (€) pour cette facture :',
        String(Math.round(defaultPartial * 100) / 100)
      );

      if (promptValue === null) {
        return;
      }

      const parsed = Number(promptValue.replace(',', '.'));

      if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= invoice.total) {
        setDashboardError('Montant invalide pour une facture partiellement payée.');
        return;
      }

      nextPaidAmount = parsed;
    }

    const runUpdatePayment = async () => {
      try {
        setUpdatingPaymentInvoiceId(invoice.id);

        const response = await fetch(`/api/invoices/${invoice.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            paymentStatus: nextPaymentStatus,
            paidAmount: nextPaidAmount,
            paidDate: nextPaymentStatus === 'unpaid'
              ? ''
              : new Intl.DateTimeFormat('fr-FR').format(new Date()),
          }),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          setDashboardError(result.error || 'Impossible de mettre à jour le statut de paiement.');
          return;
        }

        setDashboardSuccess('Paiement mis à jour.');
        await loadDashboardData();
      } catch {
        setDashboardError('Erreur réseau pendant la mise à jour du paiement.');
      } finally {
        setUpdatingPaymentInvoiceId('');
      }
    };

    runUpdatePayment();
  }, [loadDashboardData, resetDashboardMessages]);

  const handleCreateRevisedQuote = useCallback((invoice: InvoiceRecord) => {
    resetDashboardMessages();

    if (invoice.status === 'accepted') {
      setDashboardError('Ce devis est accepté, il ne peut plus être modifié.');
      return;
    }

    const totalInput = window.prompt('Nouveau montant du devis après négociation (€)', String(invoice.total));
    if (totalInput === null) {
      return;
    }

    const parsedTotal = Number(totalInput.replace(',', '.'));

    if (!Number.isFinite(parsedTotal) || parsedTotal < 0) {
      setDashboardError('Le montant révisé doit être un nombre positif.');
      return;
    }

    const noteInput = window.prompt('Ajoute une note (optionnel) :', invoice.negotiationNote || '');
    if (noteInput === null) {
      return;
    }

    const runSave = async () => {
      try {
        setIsCreatingRevisionForQuoteId(invoice.id);

        const response = await fetch(`/api/invoices/${invoice.id}/revise`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            revisedTotal: parsedTotal,
            note: noteInput,
          }),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          setDashboardError(result.error || 'Impossible de créer le devis après négociation.');
          return;
        }

        setDashboardSuccess('Devis après négociation créé avec succès.');
        await loadDashboardData();
      } catch {
        setDashboardError('Erreur réseau pendant la création du devis révisé.');
      } finally {
        setIsCreatingRevisionForQuoteId('');
      }
    };

    runSave();
  }, [loadDashboardData, resetDashboardMessages]);

  const handleDeleteInvoice = useCallback((invoice: InvoiceRecord) => {
    resetDashboardMessages();

    const confirmed = window.confirm(`Supprimer le devis #${invoice.quoteNumber} ?`);
    if (!confirmed) {
      return;
    }

    const runDelete = async () => {
      try {
        setDeletingInvoiceId(invoice.id);

        const response = await fetch(`/api/invoices/${invoice.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          setDashboardError(result.error || 'Impossible de supprimer ce devis.');
          return;
        }

        setDashboardSuccess('Devis supprimé.');
        await loadDashboardData();
      } catch {
        setDashboardError('Erreur réseau pendant la suppression du devis.');
      } finally {
        setDeletingInvoiceId('');
      }
    };

    runDelete();
  }, [loadDashboardData, resetDashboardMessages]);

  const handleConvertToInvoice = useCallback((quote: InvoiceRecord) => {
    resetDashboardMessages();

    const runConvert = async () => {
      try {
        setIsConvertingToInvoice(quote.id);

        const response = await fetch(`/api/invoices/${quote.id}/convert`, {
          method: 'POST',
          credentials: 'include',
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          setDashboardError(result.error || 'Impossible de convertir ce devis en facture.');
          return;
        }

        setDashboardSuccess(result.alreadyExists ? 'Facture déjà créée pour ce devis.' : 'Facture créée avec succès.');
        await loadDashboardData();
        setActiveTab('invoices');
      } catch {
        setDashboardError('Erreur réseau pendant la conversion en facture.');
      } finally {
        setIsConvertingToInvoice('');
      }
    };

    runConvert();
  }, [loadDashboardData, resetDashboardMessages]);

  const handleExportInvoicesCsv = useCallback(() => {
    resetDashboardMessages();

    const runExport = async () => {
      try {
        setIsExportingInvoicesCsv(true);

        const response = await fetch('/api/invoices/export', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          setDashboardError(result.error || 'Impossible d\'exporter les factures en CSV.');
          return;
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);

        const contentDisposition = response.headers.get('content-disposition') || '';
        const filenameMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
        const downloadName = filenameMatch?.[1] || `factures_${new Date().toISOString().slice(0, 10)}.csv`;

        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = downloadName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);

        setDashboardSuccess('Export CSV téléchargé.');
      } catch {
        setDashboardError('Erreur réseau pendant l\'export CSV.');
      } finally {
        setIsExportingInvoicesCsv(false);
      }
    };

    runExport();
  }, [resetDashboardMessages]);

  const handleSaveProfile = useCallback(() => {
    resetDashboardMessages();

    const runSaveProfile = async () => {
      const normalizedCompanyName = profileCompanyName.trim();

      if (!normalizedCompanyName) {
        setDashboardError('Le nom de la société est obligatoire.');
        return;
      }

      if (profilePassword.trim() && profilePassword.trim().length < 8) {
        setDashboardError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
        return;
      }

      try {
        setIsSavingProfile(true);

        const response = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            companyName: normalizedCompanyName,
            siret: profileSiret,
            password: profilePassword,
          }),
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          setDashboardError(result.error || 'Impossible de mettre à jour le profil.');
          return;
        }

        setCurrentUser(result.user);
        setProfilePassword('');
        setDashboardSuccess('Profil mis à jour.');
      } catch {
        setDashboardError('Erreur réseau pendant la mise à jour du profil.');
      } finally {
        setIsSavingProfile(false);
      }
    };

    runSaveProfile();
  }, [profileCompanyName, profilePassword, profileSiret, resetDashboardMessages]);

  if (!isClient) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </main>
    );
  }

  if (isAuthLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </main>
    );
  }

  if (!currentUser) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-8 flex items-center justify-center">
        <div className="w-full max-w-2xl bg-white/85 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 md:p-12">
          <div className="mb-10">
            <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-3">
              {authMode === 'register' ? 'Créer votre compte' : 'Connexion'}
            </h1>
            <p className="text-gray-500 text-lg">
              {authMode === 'register'
                ? 'Renseignez les informations de votre société pour générer vos devis.'
                : 'Connectez-vous pour continuer vos devis.'}
            </p>
          </div>

          <div className="space-y-5">
            {authMode === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Nom de la société <span className="text-red-500">*</span>
                  </label>
                  <input
                    placeholder="Ex: Artisan Flow SARL"
                    className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white/50 text-gray-900 placeholder-gray-400"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">SIRET</label>
                  <input
                    placeholder="Ex: 123 456 789 00012"
                    className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white/50 text-gray-900 placeholder-gray-400"
                    value={siret}
                    onChange={(e) => setSiret(e.target.value)}
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                placeholder="vous@entreprise.fr"
                className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white/50 text-gray-900 placeholder-gray-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Mot de passe <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                placeholder="Minimum 8 caractères"
                className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white/50 text-gray-900 placeholder-gray-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {authError && (
              <div className="text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl text-sm font-medium">
                {authError}
              </div>
            )}

            {authSuccess && (
              <div className="text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-sm font-medium">
                {authSuccess}
              </div>
            )}

            <button
              onClick={authMode === 'register' ? handleRegister : handleLogin}
              className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-200/50 transition-all"
            >
              {authMode === 'register' ? 'Créer le compte' : 'Se connecter'}
            </button>

            <button
              onClick={() => {
                resetAuthMessages();
                setAuthMode((prev) => (prev === 'register' ? 'login' : 'register'));
              }}
              className="w-full text-blue-700 hover:text-blue-800 font-semibold py-2"
            >
              {authMode === 'register'
                ? 'Déjà un compte ? Se connecter'
                : 'Pas encore de compte ? S\'inscrire'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const activeTabTitle =
    activeTab === 'home'
      ? 'Accueil'
      : activeTab === 'analytics'
        ? 'Dashboard+'
      : activeTab === 'quote'
      ? 'Nouveau Devis'
      : activeTab === 'history'
        ? 'Historique des devis'
        : activeTab === 'invoices'
          ? 'Factures'
        : activeTab === 'clients'
          ? 'Clients'
          : activeTab === 'map'
            ? 'Carte des devis'
            : 'Mon profil';

  const activeTabSubtitle =
    activeTab === 'home'
      ? 'Vue rapide de vos devis et factures'
      : activeTab === 'analytics'
        ? 'Graphiques de suivi et répartition de vos performances'
      : activeTab === 'quote'
      ? 'Créez votre devis professionnel en quelques clics'
      : activeTab === 'history'
        ? 'Suivez vos devis, leurs statuts et téléchargez-les'
        : activeTab === 'invoices'
          ? 'Retrouvez et téléchargez toutes vos factures'
        : activeTab === 'clients'
          ? 'Gérez votre base clients et leurs devis'
          : activeTab === 'map'
            ? 'Visualisez la localisation de vos devis'
            : 'Mettez à jour les informations de votre société';

  const quickSearchPlaceholder =
    activeTab === 'home'
      ? 'Recherche globale...'
      : activeTab === 'analytics'
        ? 'Recherche globale dashboard...'
      : activeTab === 'history'
      ? 'Rechercher un devis, client ou numéro...'
      : activeTab === 'invoices'
        ? 'Rechercher une facture...'
      : activeTab === 'clients'
        ? 'Rechercher un client...'
        : activeTab === 'map'
          ? 'Recherche globale (aperçu carte)...'
        : 'Recherche rapide...';

  const userDisplayName = currentUser.companyName.trim() || currentUser.email.split('@')[0] || 'Utilisateur';

  const currentDateLabel = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-[280px_1fr] gap-6">
        <aside className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 p-5 md:p-6 lg:sticky lg:top-6 h-fit">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 rounded-2xl shadow-lg text-white shrink-0">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Tableau de bord</p>
              <p className="font-bold text-gray-900">{currentUser.companyName}</p>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => {
                resetDashboardMessages();
                setActiveTab('home');
              }}
              className={`w-full px-4 py-3 rounded-xl border font-semibold transition-all flex items-center gap-3 ${
                activeTab === 'home'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200/50'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <FileText size={18} />
              Home
            </button>

            <button
              onClick={() => {
                resetDashboardMessages();
                setActiveTab('analytics');
              }}
              className={`w-full px-4 py-3 rounded-xl border font-semibold transition-all flex items-center gap-3 ${
                activeTab === 'analytics'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200/50'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <BarChart3 size={18} />
              Dashboard+
            </button>

            <button
              onClick={() => {
                resetDashboardMessages();
                setActiveTab('quote');
              }}
              className={`w-full px-4 py-3 rounded-xl border font-semibold transition-all flex items-center gap-3 ${
                activeTab === 'quote'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200/50'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <FileText size={18} />
              Devis
            </button>

            <button
              onClick={() => {
                resetDashboardMessages();
                setActiveTab('history');
              }}
              className={`w-full px-4 py-3 rounded-xl border font-semibold transition-all flex items-center gap-3 ${
                activeTab === 'history'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200/50'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <History size={18} />
              Historique
            </button>

            <button
              onClick={() => {
                resetDashboardMessages();
                setActiveTab('clients');
              }}
              className={`w-full px-4 py-3 rounded-xl border font-semibold transition-all flex items-center gap-3 ${
                activeTab === 'clients'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200/50'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Users size={18} />
              Clients
            </button>

            <button
              onClick={() => {
                resetDashboardMessages();
                setActiveTab('invoices');
              }}
              className={`w-full px-4 py-3 rounded-xl border font-semibold transition-all flex items-center gap-3 ${
                activeTab === 'invoices'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200/50'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <FileText size={18} />
              Factures
            </button>

            <button
              onClick={() => {
                resetDashboardMessages();
                setActiveTab('map');
              }}
              className={`w-full px-4 py-3 rounded-xl border font-semibold transition-all flex items-center gap-3 ${
                activeTab === 'map'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200/50'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <MapPin size={18} />
              Carte
            </button>

            <button
              onClick={() => {
                resetDashboardMessages();
                setActiveTab('profile');
              }}
              className={`w-full px-4 py-3 rounded-xl border font-semibold transition-all flex items-center gap-3 ${
                activeTab === 'profile'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200/50'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <UserRound size={18} />
              Profil
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all font-semibold"
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <LogOut size={18} />
              Déconnexion
            </button>
          </div>
        </aside>

        <section className="bg-white/85 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 p-6 md:p-10">
          <div className="sticky top-4 z-20 mb-6 p-4 rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-md shadow-sm">
            <div className="flex flex-col xl:flex-row xl:items-center gap-3 xl:justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <p className="text-sm font-semibold text-gray-700 capitalize">{currentDateLabel}</p>
                <span className="hidden sm:inline text-gray-300">•</span>
                <p className="text-sm text-gray-500">{currentUser.companyName}</p>
              </div>

              <div className="flex flex-col md:flex-row gap-2 w-full xl:w-auto xl:min-w-[540px]">
                <input
                  value={globalSearch}
                  onChange={(event) => setGlobalSearch(event.target.value)}
                  placeholder={quickSearchPlaceholder}
                  className="w-full p-3 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400"
                />

                <button
                  onClick={() => {
                    resetDashboardMessages();
                    setActiveTab('quote');
                  }}
                  className="px-4 py-3 whitespace-nowrap bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold"
                >
                  + Nouveau devis
                </button>
              </div>
            </div>
          </div>

          <div className="mb-8 pb-6 border-b border-gray-100">
            <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
              {activeTabTitle}
            </h1>
            <p className="text-gray-500 text-base md:text-lg">{activeTabSubtitle}</p>
          </div>

          {isDataLoading && (
            <div className="mb-6 text-sm text-gray-600 bg-gray-50 border border-gray-200 p-3 rounded-xl">
              Chargement des données...
            </div>
          )}

          {dashboardError && (
            <div className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl">
              {dashboardError}
            </div>
          )}

          {dashboardSuccess && (
            <div className="mb-6 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
              {dashboardSuccess}
            </div>
          )}

          {activeTab === 'home' && (
            <div className="space-y-8">
              <div className="border border-blue-100 bg-blue-50 rounded-2xl p-5">
                <h2 className="text-2xl font-black text-blue-900">Bienvenue, {userDisplayName}</h2>
                <p className="text-sm text-blue-700 mt-1">Voici le résumé de votre activité devis et factures.</p>
              </div>

              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-4">Devis</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="border border-gray-200 bg-white rounded-2xl p-5">
                    <p className="text-sm text-gray-500">Total</p>
                    <p className="text-3xl font-black text-gray-900 mt-2">{quoteStats.total}</p>
                  </div>
                  <div className="border border-blue-200 bg-blue-50 rounded-2xl p-5">
                    <p className="text-sm text-blue-700">En attente</p>
                    <p className="text-3xl font-black text-blue-800 mt-2">{quoteStats.sent}</p>
                  </div>
                  <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-5">
                    <p className="text-sm text-emerald-700">Acceptés</p>
                    <p className="text-3xl font-black text-emerald-800 mt-2">{quoteStats.accepted}</p>
                  </div>
                  <div className="border border-red-200 bg-red-50 rounded-2xl p-5">
                    <p className="text-sm text-red-700">Refusés</p>
                    <p className="text-3xl font-black text-red-800 mt-2">{quoteStats.rejected}</p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-4">Factures</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="border border-gray-200 bg-white rounded-2xl p-5">
                    <p className="text-sm text-gray-500">Total</p>
                    <p className="text-3xl font-black text-gray-900 mt-2">{invoiceStats.total}</p>
                  </div>
                  <div className="border border-blue-200 bg-blue-50 rounded-2xl p-5">
                    <p className="text-sm text-blue-700">À payer</p>
                    <p className="text-3xl font-black text-blue-800 mt-2">{invoiceStats.unpaid}</p>
                  </div>
                  <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-5">
                    <p className="text-sm text-emerald-700">Payées</p>
                    <p className="text-3xl font-black text-emerald-800 mt-2">{invoiceStats.paid}</p>
                  </div>
                  <div className="border border-amber-200 bg-amber-50 rounded-2xl p-5">
                    <p className="text-sm text-amber-700">Partiellement payées</p>
                    <p className="text-3xl font-black text-amber-800 mt-2">{invoiceStats.partial}</p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-4">Finances</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="border border-gray-200 bg-white rounded-2xl p-5">
                    <p className="text-sm text-gray-500">CA facturé</p>
                    <p className="text-3xl font-black text-gray-900 mt-2">
                      {financialStats.totalInvoiced.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </p>
                  </div>
                  <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-5">
                    <p className="text-sm text-emerald-700">CA encaissé</p>
                    <p className="text-3xl font-black text-emerald-800 mt-2">
                      {financialStats.totalCollected.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </p>
                  </div>
                  <div className="border border-blue-200 bg-blue-50 rounded-2xl p-5">
                    <p className="text-sm text-blue-700">Reste à encaisser</p>
                    <p className="text-3xl font-black text-blue-800 mt-2">
                      {financialStats.remainingToCollect.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                    </p>
                  </div>
                  <div className="border border-red-200 bg-red-50 rounded-2xl p-5">
                    <p className="text-sm text-red-700">Factures en retard</p>
                    <p className="text-3xl font-black text-red-800 mt-2">{invoiceDueInsights.overdueCount}</p>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-4">Échéances</h2>

                {invoiceDueInsights.overdueInvoices.length === 0 ? (
                  <div className="text-gray-600 bg-gray-50 border border-gray-200 rounded-2xl p-6">
                    Aucune facture en retard. Super 👌
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invoiceDueInsights.overdueInvoices.map((invoice) => (
                      <div key={invoice.id} className="border border-red-200 bg-red-50 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="font-bold text-red-900">Facture #{invoice.quoteNumber} · {invoice.clientName}</p>
                          <p className="text-sm text-red-700">Échéance: {invoice.dueDateLabel} · Retard: {invoice.daysLate} jour(s)</p>
                        </div>
                        <p className="font-black text-red-900">
                          {invoice.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-8">
              <div className="border border-gray-200 bg-white rounded-2xl p-5">
                <h2 className="text-2xl font-black text-gray-900 mb-4">Évolution mensuelle</h2>
                <p className="text-sm text-gray-500 mb-4">Comparaison du facturé et de l&apos;encaissé sur les 6 derniers mois.</p>

                <div className="h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyRevenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="label" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip
                        formatter={(value: number) => value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                      />
                      <Legend />
                      <Bar dataKey="billed" name="Facturé" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="collected" name="Encaissé" fill="#10b981" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="border border-gray-200 bg-white rounded-2xl p-5">
                  <h2 className="text-2xl font-black text-gray-900 mb-4">Répartition devis</h2>

                  {quoteStatusPieData.length === 0 ? (
                    <div className="text-gray-600 bg-gray-50 border border-gray-200 rounded-2xl p-6">
                      Aucun devis disponible.
                    </div>
                  ) : (
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip />
                          <Legend />
                          <Pie
                            data={quoteStatusPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={110}
                            label
                          >
                            {quoteStatusPieData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 bg-white rounded-2xl p-5">
                  <h2 className="text-2xl font-black text-gray-900 mb-4">Répartition factures</h2>

                  {invoiceStatusPieData.length === 0 ? (
                    <div className="text-gray-600 bg-gray-50 border border-gray-200 rounded-2xl p-6">
                      Aucune facture disponible.
                    </div>
                  ) : (
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip />
                          <Legend />
                          <Pie
                            data={invoiceStatusPieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={110}
                            label
                          >
                            {invoiceStatusPieData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'quote' && (
            <>
              <div className="grid gap-8 mb-12">
                <div className="group">
                  <label className="block text-sm font-bold text-gray-700 mb-3">Client existant (optionnel)</label>
                  <select
                    className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white text-gray-900"
                    value={selectedClientId}
                    onChange={(event) => handleSelectClientForQuote(event.target.value)}
                  >
                    <option value="">Choisir un client enregistré</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="group">
                  <label className="block text-sm font-bold text-gray-700 mb-3">Lieu du devis (adresse)</label>
                  <div className="relative">
                    <input
                      placeholder="Ex: 12 rue de Paris, 69000 Lyon"
                      className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white text-gray-900 placeholder-gray-400"
                      value={quoteLocation}
                      onFocus={() => setShowAddressSuggestions(true)}
                      onBlur={() => {
                        setTimeout(() => {
                          setShowAddressSuggestions(false);
                        }, 150);
                      }}
                      onChange={(event) => {
                        setQuoteLocation(event.target.value);
                        setQuoteLocationLat(null);
                        setQuoteLocationLng(null);
                        setShowAddressSuggestions(true);
                      }}
                    />

                    {showAddressSuggestions && (
                      <div className="absolute z-30 mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-xl max-h-72 overflow-auto">
                        {isAddressSuggestionsLoading && (
                          <div className="px-4 py-3 text-sm text-gray-500">Recherche d&apos;adresses...</div>
                        )}

                        {!isAddressSuggestionsLoading && addressSuggestions.length === 0 && quoteLocation.trim().length >= 3 && (
                          <div className="px-4 py-3 text-sm text-gray-500">Aucune suggestion trouvée.</div>
                        )}

                        {!isAddressSuggestionsLoading && addressSuggestions.map((suggestion, index) => (
                          <button
                            key={`${suggestion.label}-${suggestion.postcode}-${index}`}
                            type="button"
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-b-0 border-gray-100"
                            onMouseDown={() => {
                              const cityLabel = [suggestion.postcode, suggestion.city].filter(Boolean).join(' ');
                              const fullLabel = cityLabel
                                ? `${suggestion.label}, ${cityLabel}`
                                : suggestion.label;

                              setQuoteLocation(fullLabel);
                              setQuoteLocationLat(suggestion.lat);
                              setQuoteLocationLng(suggestion.lng);
                              setShowAddressSuggestions(false);
                            }}
                          >
                            <p className="text-sm font-semibold text-gray-900">{suggestion.label}</p>
                            <p className="text-xs text-gray-500">
                              {[suggestion.postcode, suggestion.city].filter(Boolean).join(' ')}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="group">
                  <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    Nom du client <span className="text-red-500">*</span>
                  </label>
                  <input
                    placeholder="Ex: Société XYZ, Jean Dupont SARL..."
                    className="w-full p-5 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white/50 backdrop-blur-sm text-xl text-gray-900 placeholder-gray-400"
                    value={clientName}
                    onChange={(e) => {
                      setClientName(e.target.value);
                      if (!e.target.value.trim()) {
                        setSelectedClientId('');
                      }
                    }}
                    autoFocus
                  />
                </div>

                <div className="group">
                  <label className="block text-sm font-bold text-gray-700 mb-3">Signature client (bon pour accord)</label>
                  <input
                    placeholder="Ex: Jean Dupont"
                    className="w-full p-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-white text-gray-900 placeholder-gray-400"
                    value={quoteSignatureName}
                    onChange={(event) => setQuoteSignatureName(event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-6 mb-12">
                <label className="block text-xl font-bold text-gray-800 flex items-center gap-2 mb-6">
                  Articles / Prestations
                </label>

                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="group/item bg-white/60 backdrop-blur-sm p-6 rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all hover:-translate-y-0.5">
                      <div className="grid grid-cols-1 md:grid-cols-[3fr_1fr_1fr_auto] gap-4 items-end">
                        <div>
                          <input
                            placeholder="Description de la prestation / produit..."
                            className="w-full p-4 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none transition-all text-lg text-gray-900 placeholder-gray-400"
                            value={item.designation}
                            onChange={(e) => updateItem(item.id, 'designation', e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Qté</label>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            placeholder="1"
                            className="w-full p-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none text-right font-mono text-gray-900 placeholder-gray-400"
                            value={item.qty}
                            onChange={(e) => updateItem(item.id, 'qty', e.target.value)}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Prix HT (€)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full p-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 outline-none text-right font-mono text-gray-900 placeholder-gray-400"
                            value={item.prix}
                            onChange={(e) => updateItem(item.id, 'prix', e.target.value)}
                          />
                        </div>

                        {items.length > 1 && (
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-3 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all group-hover/item:scale-110 aspect-square flex items-center justify-center shadow-sm hover:shadow-md"
                            title="Supprimer cette ligne"
                            aria-label="Supprimer cette ligne"
                          >
                            <Trash2 size={20} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addItem}
                  className="w-full py-6 border-2 border-dashed border-blue-300 rounded-2xl text-blue-600 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-3 font-semibold backdrop-blur-sm shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus size={24} />
                  Ajouter une nouvelle prestation
                </button>
              </div>

              <div className="mt-16 pt-10 border-t border-gray-100/50">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl md:text-4xl font-black text-gray-900 bg-gradient-to-r from-gray-900 to-black bg-clip-text text-transparent tracking-tight">
                      {total.toLocaleString('fr-FR', {
                        style: 'currency',
                        currency: 'EUR',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                    <span className="text-sm text-gray-500 font-medium uppercase tracking-wide">HT</span>
                  </div>

                  {!hasValidData && (
                    <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 px-4 py-2 rounded-xl border border-orange-200">
                      <AlertCircle size={16} />
                      Complétez le nom du client et au moins une prestation
                    </div>
                  )}
                </div>

                <PDFDownloadLink
                  document={
                    <InvoicePDF
                      data={{
                        clientName: clientName || 'Client',
                        items: items.filter(item => item.designation.trim()),
                        total,
                        societe: currentUser.companyName,
                        siret: currentUser.siret || '000 000 000 00000',
                        quoteNumber,
                        issueDate,
                        documentType: 'quote',
                        signatureName: quoteSignatureName.trim(),
                      }}
                    />
                  }
                  fileName={`devis_${sanitizedClientName}.pdf`}
                  className={`
                    w-full h-16 bg-gradient-to-r from-blue-600 to-indigo-600
                    hover:from-blue-700 hover:to-indigo-700 text-white
                    font-bold rounded-2xl flex items-center justify-center gap-3
                    shadow-xl shadow-blue-200/50 hover:shadow-2xl hover:shadow-blue-300/60
                    transition-all duration-300 active:scale-[0.97] active:shadow-lg
                    disabled:from-gray-400 disabled:to-gray-500 disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100
                    ${!hasValidData ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  onClick={handleDownload}
                >
                  {({ loading }) => (
                    <span className="flex items-center gap-3 font-bold">
                      <Download size={24} />
                      {loading || isSavingInvoice
                        ? <span className="flex items-center gap-2">
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Génération du PDF...
                          </span>
                        : 'Télécharger le Devis (PDF)'
                      }
                    </span>
                  )}
                </PDFDownloadLink>
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div>
              <h2 className="text-2xl font-black text-gray-900 mb-6">Historique des devis</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <input
                  placeholder="Rechercher par client ou numéro..."
                  className="w-full p-3 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400"
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                />

                <select
                  className="w-full p-3 border border-gray-200 rounded-xl bg-white text-gray-900"
                  value={historyStatusFilter}
                  onChange={(event) => setHistoryStatusFilter(event.target.value as 'all' | 'sent' | 'accepted' | 'rejected')}
                >
                  <option value="all">Tous les statuts</option>
                  <option value="sent">Envoyé</option>
                  <option value="accepted">Accepté</option>
                  <option value="rejected">Refusé</option>
                </select>
              </div>

              {groupedQuoteFamilies.length === 0 ? (
                <div className="text-gray-600 bg-gray-50 border border-gray-200 rounded-2xl p-6">
                  Aucun devis trouvé avec ces filtres.
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedQuoteFamilies.map((family) => {
                    const familyLabel = family[0]?.clientName || 'Client';

                    return (
                      <div key={family[0]?.sourceQuoteId || family[0]?.id} className="border border-gray-200 bg-white rounded-2xl p-4 space-y-3">
                        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{familyLabel}</p>

                        {family.map((invoice, index) => (
                          <div key={invoice.id} className="border border-gray-200 bg-white rounded-xl p-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            <div>
                              <p className="font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                                <span>
                                  {index === 0 ? 'Devis initial' : `Devis après négo ${index}`} · #{invoice.quoteNumber}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded-full border ${getStatusBadgeClass(invoice.status)}`}>
                                  {getStatusLabel(invoice.status)}
                                </span>
                              </p>
                              <p className="text-sm text-gray-500">{invoice.issueDate} · {invoice.items.length} ligne(s)</p>
                              {invoice.negotiationNote && (
                                <p className="text-sm text-amber-700 mt-1">Négociation: {invoice.negotiationNote}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-3 flex-wrap justify-end">
                              <p className="font-semibold text-blue-700">
                                {invoice.total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                              </p>

                              <select
                                className="px-3 py-2 border border-gray-200 rounded-xl bg-white text-gray-900 text-sm"
                                value={invoice.status}
                                disabled={updatingInvoiceId === invoice.id || convertedQuoteIds.has(invoice.id)}
                                onChange={(event) => handleUpdateInvoiceStatus(invoice.id, event.target.value as InvoiceRecord['status'])}
                              >
                                <option value="sent">Envoyé</option>
                                <option value="accepted">Accepté</option>
                                <option value="rejected">Refusé</option>
                              </select>

                              <PDFDownloadLink
                                document={
                                  <InvoicePDF
                                    data={{
                                      clientName: invoice.clientName,
                                      items: invoice.items,
                                      total: invoice.total,
                                      societe: currentUser.companyName,
                                      siret: currentUser.siret || '000 000 000 00000',
                                      quoteNumber: invoice.quoteNumber,
                                      issueDate: invoice.issueDate,
                                      documentType: invoice.documentType,
                                      signatureName: invoice.signatureName,
                                    }}
                                  />
                                }
                                fileName={`devis_${invoice.clientName.replace(/[^a-zA-Z0-9]/g, '_') || 'client'}_${invoice.quoteNumber}.pdf`}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all"
                              >
                                {({ loading }) => (loading ? 'Préparation...' : 'Télécharger')}
                              </PDFDownloadLink>

                              <button
                                onClick={() => handleDeleteInvoice(invoice)}
                                disabled={deletingInvoiceId === invoice.id}
                                className="px-4 py-2 border border-red-300 text-red-700 rounded-xl font-semibold text-sm hover:bg-red-50 disabled:opacity-60"
                              >
                                {deletingInvoiceId === invoice.id ? 'Suppression...' : 'Supprimer'}
                              </button>

                              {convertedQuoteIds.has(invoice.id) ? (
                                <span className="px-4 py-2 border border-emerald-200 text-emerald-700 bg-emerald-50 rounded-xl font-semibold text-sm">
                                  Déjà facturé
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleConvertToInvoice(invoice)}
                                  disabled={isConvertingToInvoice === invoice.id}
                                  className="px-4 py-2 border border-emerald-300 text-emerald-700 rounded-xl font-semibold text-sm hover:bg-emerald-50 disabled:opacity-60"
                                >
                                  {isConvertingToInvoice === invoice.id ? 'Conversion...' : 'Convertir en facture'}
                                </button>
                              )}

                              <button
                                onClick={() => handleCreateRevisedQuote(invoice)}
                                disabled={
                                  isCreatingRevisionForQuoteId === invoice.id
                                  || convertedQuoteIds.has(invoice.id)
                                  || invoice.status !== 'sent'
                                }
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50 disabled:opacity-60"
                              >
                                {convertedQuoteIds.has(invoice.id)
                                  ? 'Modification bloquée (facturé)'
                                  : invoice.status !== 'sent'
                                    ? 'Modification bloquée (accepté)'
                                    : isCreatingRevisionForQuoteId === invoice.id
                                      ? 'Création...'
                                      : 'Devis après négo'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'invoices' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <h2 className="text-2xl font-black text-gray-900">Historique des factures</h2>
                <button
                  onClick={handleExportInvoicesCsv}
                  disabled={isExportingInvoicesCsv || invoiceDocuments.length === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm disabled:opacity-60"
                >
                  {isExportingInvoicesCsv ? 'Export...' : 'Exporter CSV'}
                </button>
              </div>

              {filteredInvoiceDocuments.length === 0 ? (
                <div className="text-gray-600 bg-gray-50 border border-gray-200 rounded-2xl p-6">
                  Aucune facture disponible pour le moment.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredInvoiceDocuments.map((invoice) => (
                    <div key={invoice.id} className="border border-gray-200 bg-white rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900 flex items-center gap-2 flex-wrap">
                          <span>Facture #{invoice.quoteNumber} · {invoice.clientName}</span>
                          <span className={`text-xs px-2 py-1 rounded-full border ${getPaymentStatusBadgeClass(invoice.paymentStatus)}`}>
                            {getPaymentStatusLabel(invoice.paymentStatus)}
                          </span>
                        </p>
                        <p className="text-sm text-gray-500">{invoice.issueDate} · {invoice.items.length} ligne(s)</p>
                        <p className="text-sm text-gray-500">
                          Encaissé: {(invoice.paidAmount ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                          {invoice.paidDate ? ` · ${invoice.paidDate}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap justify-end">
                        <p className="font-semibold text-blue-700">
                          {invoice.total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                        </p>

                        <select
                          className="px-3 py-2 border border-gray-200 rounded-xl bg-white text-gray-900 text-sm"
                          value={invoice.paymentStatus || 'unpaid'}
                          disabled={updatingPaymentInvoiceId === invoice.id}
                          onChange={(event) => handleUpdateInvoicePaymentStatus(invoice, event.target.value as 'unpaid' | 'partial' | 'paid')}
                        >
                          <option value="unpaid">À payer</option>
                          <option value="partial">Partiellement payée</option>
                          <option value="paid">Payée</option>
                        </select>

                        <PDFDownloadLink
                          document={
                            <InvoicePDF
                              data={{
                                clientName: invoice.clientName,
                                items: invoice.items,
                                total: invoice.total,
                                societe: currentUser.companyName,
                                siret: currentUser.siret || '000 000 000 00000',
                                quoteNumber: invoice.quoteNumber,
                                issueDate: invoice.issueDate,
                                documentType: 'invoice',
                                signatureName: invoice.signatureName,
                              }}
                            />
                          }
                          fileName={`facture_${invoice.clientName.replace(/[^a-zA-Z0-9]/g, '_') || 'client'}_${invoice.quoteNumber}.pdf`}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all"
                        >
                          {({ loading }) => (loading ? 'Préparation...' : 'Télécharger')}
                        </PDFDownloadLink>

                        <button
                          onClick={() => handleDeleteInvoice(invoice)}
                          disabled={deletingInvoiceId === invoice.id}
                          className="px-4 py-2 border border-red-300 text-red-700 rounded-xl font-semibold text-sm hover:bg-red-50 disabled:opacity-60"
                        >
                          {deletingInvoiceId === invoice.id ? 'Suppression...' : 'Supprimer'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'clients' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-4">Créer un client</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    placeholder="Nom du client *"
                    className="w-full p-4 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                  />
                  <input
                    placeholder="Email"
                    className="w-full p-4 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                  />
                  <input
                    placeholder="Téléphone"
                    className="w-full p-4 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400"
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                  />
                  <input
                    placeholder="Notes"
                    className="w-full p-4 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400"
                    value={newClientNotes}
                    onChange={(e) => setNewClientNotes(e.target.value)}
                  />
                </div>

                <button
                  onClick={handleCreateClient}
                  disabled={isCreatingClient}
                  className="mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold disabled:opacity-60"
                >
                  {isCreatingClient ? 'Création...' : 'Ajouter le client'}
                </button>
              </div>

              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-4">Liste clients & historique devis</h2>

                {filteredClients.length === 0 ? (
                  <div className="text-gray-600 bg-gray-50 border border-gray-200 rounded-2xl p-6">
                    Aucun client trouvé.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredClients.map((client) => (
                      <div key={client.id} className="border border-gray-200 bg-white rounded-2xl p-5">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                          <div>
                            <p className="text-lg font-bold text-gray-900">{client.name}</p>
                            <p className="text-sm text-gray-500">{client.email || 'Sans email'} · {client.phone || 'Sans téléphone'}</p>
                            <p className="text-sm text-gray-500">{client.invoiceCount} devis · Dernier: {client.lastInvoiceAt ? new Date(client.lastInvoiceAt).toLocaleDateString('fr-FR') : '-'}</p>
                          </div>

                          <button
                            onClick={() => {
                              handleSelectClientForQuote(client.id);
                              setActiveTab('quote');
                            }}
                            className="px-4 py-2 border border-blue-300 text-blue-700 rounded-xl font-semibold hover:bg-blue-50"
                          >
                            Nouveau devis
                          </button>

                          <button
                            onClick={() => handleDeleteClient(client)}
                            disabled={deletingClientId === client.id}
                            className="px-4 py-2 border border-red-300 text-red-700 rounded-xl font-semibold hover:bg-red-50 disabled:opacity-60"
                          >
                            {deletingClientId === client.id ? 'Suppression...' : 'Supprimer client'}
                          </button>
                        </div>

                        <div className="space-y-2">
                          {(invoicesByClient[client.id] || []).slice(0, 5).map((invoice) => (
                            <div key={invoice.id} className="text-sm bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between">
                              <span className="text-gray-700">#{invoice.quoteNumber} · {invoice.issueDate}</span>
                              <span className="font-semibold text-gray-900">
                                {invoice.total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                              </span>
                            </div>
                          ))}

                          {(invoicesByClient[client.id] || []).length === 0 && (
                            <p className="text-sm text-gray-500">Aucun devis pour ce client.</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'map' && (
            <div className="space-y-5">
              <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 p-3 rounded-xl">
                La carte affiche les devis géolocalisés. Ajoute un lieu dans le formulaire de devis pour créer un point automatiquement.
              </div>

              <InvoiceMap invoices={invoices} />
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="max-w-2xl">
              <h2 className="text-2xl font-black text-gray-900 mb-6">Mon profil</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Nom de la société</label>
                  <input
                    className="w-full p-4 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400"
                    value={profileCompanyName}
                    onChange={(e) => setProfileCompanyName(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">SIRET</label>
                  <input
                    className="w-full p-4 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400"
                    value={profileSiret}
                    onChange={(e) => setProfileSiret(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
                  <input
                    className="w-full p-4 border border-gray-200 rounded-xl bg-gray-100 text-gray-500"
                    value={currentUser.email}
                    disabled
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Nouveau mot de passe (optionnel)</label>
                  <input
                    type="password"
                    placeholder="Minimum 8 caractères"
                    className="w-full p-4 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-400"
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                  />
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="mt-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold disabled:opacity-60"
                >
                  {isSavingProfile ? 'Enregistrement...' : 'Enregistrer le profil'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
