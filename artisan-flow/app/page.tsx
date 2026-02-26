"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Plus, Download, Trash2, FileText, AlertCircle, LogOut, UserRound, History, Users } from 'lucide-react';
import { InvoicePDF } from '@/components/InvoicePDF';

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
  { ssr: false, loading: () => <div className="animate-pulse h-12 bg-gray-200 rounded-xl" /> }
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
  quoteNumber: string;
  issueDate: string;
  createdAt: string;
}

type AuthMode = 'login' | 'register';
type ActiveTab = 'quote' | 'history' | 'clients' | 'profile';

export default function CreateInvoice() {
  const [isClient, setIsClient] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [clientName, setClientName] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('quote');
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
  const [deletingClientId, setDeletingClientId] = useState('');

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
        fetch('/api/clients', { credentials: 'include' }),
        fetch('/api/invoices', { credentials: 'include' }),
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
            clientId: selectedClientId,
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
        setSelectedClientId('');
        setItems([{ id: crypto.randomUUID(), designation: '', prix: 0, qty: 1 }]);
        setAuthMode('login');
        setActiveTab('quote');
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 md:p-12">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-10 pb-8 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-2xl shadow-lg text-white shrink-0">
                <FileText size={32} />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">
                  Nouveau Devis
                </h1>
                <p className="text-gray-500 text-lg">Créez votre devis professionnel en quelques clics</p>
                <p className="text-sm text-blue-700 font-semibold mt-1">
                  Société connectée : {currentUser.companyName}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all font-semibold"
              title="Se déconnecter"
              aria-label="Se déconnecter"
            >
              <LogOut size={18} />
              Déconnexion
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <button
              onClick={() => {
                resetDashboardMessages();
                setActiveTab('quote');
              }}
              className={`px-4 py-3 rounded-xl border font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'quote'
                  ? 'bg-blue-600 text-white border-blue-600'
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
              className={`px-4 py-3 rounded-xl border font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-blue-600 text-white border-blue-600'
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
              className={`px-4 py-3 rounded-xl border font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'clients'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Users size={18} />
              Clients
            </button>

            <button
              onClick={() => {
                resetDashboardMessages();
                setActiveTab('profile');
              }}
              className={`px-4 py-3 rounded-xl border font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'profile'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              <UserRound size={18} />
              Profil
            </button>
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

              {invoices.length === 0 ? (
                <div className="text-gray-600 bg-gray-50 border border-gray-200 rounded-2xl p-6">
                  Aucun devis enregistré pour le moment.
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="border border-gray-200 bg-white rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900">Devis #{invoice.quoteNumber} · {invoice.clientName}</p>
                        <p className="text-sm text-gray-500">{invoice.issueDate} · {invoice.items.length} ligne(s)</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <p className="font-semibold text-blue-700">
                          {invoice.total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                        </p>

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
                              }}
                            />
                          }
                          fileName={`devis_${invoice.clientName.replace(/[^a-zA-Z0-9]/g, '_') || 'client'}_${invoice.quoteNumber}.pdf`}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all"
                        >
                          {({ loading }) => (loading ? 'Préparation...' : 'Télécharger')}
                        </PDFDownloadLink>
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

                {clients.length === 0 ? (
                  <div className="text-gray-600 bg-gray-50 border border-gray-200 rounded-2xl p-6">
                    Aucun client enregistré.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {clients.map((client) => (
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
        </div>
      </div>
    </main>
  );
}
