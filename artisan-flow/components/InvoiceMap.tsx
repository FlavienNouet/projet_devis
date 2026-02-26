"use client";

import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import type { LatLngExpression } from 'leaflet';

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

interface MapInvoice {
  id: string;
  clientName: string;
  total: number;
  status: 'sent' | 'accepted' | 'rejected';
  issueDate: string;
  quoteNumber: string;
  locationAddress?: string;
  locationLat?: number;
  locationLng?: number;
}

interface InvoiceMapProps {
  invoices: MapInvoice[];
}

const getStatusLabel = (status: MapInvoice['status']) => {
  if (status === 'sent') return 'Envoyé';
  if (status === 'accepted') return 'Accepté';
  return 'Refusé';
};

export function InvoiceMap({ invoices }: InvoiceMapProps) {
  const mappable = invoices.filter(
    (invoice) => Number.isFinite(invoice.locationLat) && Number.isFinite(invoice.locationLng)
  );

  if (mappable.length === 0) {
    return (
      <div className="text-gray-600 bg-gray-50 border border-gray-200 rounded-2xl p-6">
        Aucun devis géolocalisé pour le moment. Renseigne un lieu lors de la création du devis.
      </div>
    );
  }

  const center: LatLngExpression = [mappable[0].locationLat as number, mappable[0].locationLng as number];

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200">
      <MapContainer center={center} zoom={10} scrollWheelZoom className="h-[560px] w-full z-0">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {mappable.map((invoice) => (
          <Marker
            key={invoice.id}
            position={[invoice.locationLat as number, invoice.locationLng as number]}
          >
            <Popup>
              <div className="text-sm">
                <p><strong>Devis #{invoice.quoteNumber}</strong></p>
                <p>{invoice.clientName}</p>
                <p>{invoice.issueDate}</p>
                <p>{invoice.total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</p>
                <p>Statut: {getStatusLabel(invoice.status)}</p>
                {invoice.locationAddress && <p>Lieu: {invoice.locationAddress}</p>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
