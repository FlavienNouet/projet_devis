import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

interface InvoiceItem {
  designation: string;
  prix: number;
  qty: number;
}

interface InvoiceData {
  clientName: string;
  items: InvoiceItem[];
  total: number;
  societe: string;
  siret?: string;
  quoteNumber?: string;
  issueDate?: string;
  documentType?: 'quote' | 'invoice';
  signatureName?: string;
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40, borderBottom: 2, paddingBottom: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  infoSection: { marginBottom: 30, flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 10, color: '#6B7280', textTransform: 'uppercase', marginBottom: 4 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F3F4F6', padding: 8, fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', padding: 8, alignItems: 'center' },
  descCol: { flex: 3 },
  qtyCol: { flex: 1, textAlign: 'center' },
  priceCol: { flex: 1, textAlign: 'right' },
  totalSection: { marginTop: 40, alignItems: 'flex-end' },
  totalBox: { width: 150, borderTopWidth: 2, borderTopColor: '#111827', paddingTop: 10 },
  totalText: { fontSize: 16, fontWeight: 'bold' },
  signatureSection: { marginTop: 40, borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingTop: 16 },
  signatureTitle: { fontSize: 10, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 },
  signatureName: { fontSize: 12, fontWeight: 'bold', marginBottom: 6 },
  signatureLine: { fontSize: 11, color: '#6B7280' },
});

export const InvoicePDF = ({ data }: { data: InvoiceData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{data.documentType === 'invoice' ? 'FACTURE' : 'DEVIS'}</Text>
          <Text style={{ marginTop: 4 }}># {data.quoteNumber || '0000'}</Text>
        </View>
        <View style={{ textAlign: 'right' }}>
          <Text style={{ fontWeight: 'bold' }}>{data.societe}</Text>
          <Text>Siret: {data.siret || '000 000 000 000'}</Text>
        </View>
      </View>

      <View style={styles.infoSection}>
        <View>
          <Text style={styles.label}>Destinataire</Text>
          <Text style={{ fontSize: 14, fontWeight: 'bold' }}>{data.clientName || 'Client non spécifié'}</Text>
        </View>
        <View style={{ textAlign: 'right' }}>
          <Text style={styles.label}>Date</Text>
          <Text>{data.issueDate || '-'}</Text>
        </View>
      </View>

      <View style={styles.tableHeader}>
        <Text style={styles.descCol}>Description</Text>
        <Text style={styles.qtyCol}>Qté</Text>
        <Text style={styles.priceCol}>Prix HT</Text>
      </View>

      {data.items.map((item: InvoiceItem, i: number) => (
        <View key={i} style={styles.tableRow}>
          <Text style={styles.descCol}>{item.designation || 'Article sans nom'}</Text>
          <Text style={styles.qtyCol}>{item.qty || 1}</Text>
          <Text style={styles.priceCol}>{item.prix.toLocaleString('fr-FR')} €</Text>
        </View>
      ))}

      <View style={styles.totalSection}>
        <View style={styles.totalBox}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text>Total HT</Text>
            <Text>{data.total.toLocaleString('fr-FR')} €</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <Text style={styles.totalText}>Total TTC</Text>
            <Text style={styles.totalText}>{(data.total * 1.2).toLocaleString('fr-FR')} €</Text>
          </View>
        </View>
      </View>

      <View style={styles.signatureSection}>
        <Text style={styles.signatureTitle}>Bon pour accord - signature client</Text>
        <Text style={styles.signatureName}>{data.signatureName || 'Non renseignée'}</Text>
        <Text style={styles.signatureLine}>Signature: ____________________________</Text>
      </View>
    </Page>
  </Document>
);