import { Link } from "@tanstack/react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zay-app/ui/components/table";

import { formatDateTime, priceLabel } from "@/lib/format";

import { EmptyState } from "./query-state";
import StatusBadge from "./status-badge";

export default function RecentBookings({
  bookings,
}: {
  bookings: {
    id: string;
    status: string;
    agreedPriceAr: number | null;
    createdAt: Date | string;
    pickup: string;
    destination: string;
  }[];
}) {
  if (bookings.length === 0) {
    return <EmptyState title="Aucune réservation" />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Trajet</TableHead>
          <TableHead>Prix</TableHead>
          <TableHead>Statut</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <Link
                className="underline"
                params={{ bookingId: item.id }}
                to="/admin/reservations/$bookingId"
              >
                {formatDateTime(item.createdAt)}
              </Link>
            </TableCell>
            <TableCell>
              {item.pickup} → {item.destination}
            </TableCell>
            <TableCell>{priceLabel(item.agreedPriceAr)}</TableCell>
            <TableCell>
              <StatusBadge kind="booking" status={item.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
