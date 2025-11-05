import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Room, Booking } from "@shared/api";
import { Trash2, Plus, Calendar, Users, Edit, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function Admin() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomCapacity, setNewRoomCapacity] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Edit room modal state
  const [editRoomModalOpen, setEditRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editRoomName, setEditRoomName] = useState("");
  const [editRoomCapacity, setEditRoomCapacity] = useState("");

  // Edit booking modal state
  const [editBookingModalOpen, setEditBookingModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editBookingName, setEditBookingName] = useState("");
  const [editBookingEmail, setEditBookingEmail] = useState("");
  const [editBookingDate, setEditBookingDate] = useState("");
  const [editBookingStartTime, setEditBookingStartTime] = useState("");
  const [editBookingEndTime, setEditBookingEndTime] = useState("");
  const [editBookingRoomId, setEditBookingRoomId] = useState("");

  useEffect(() => {
    fetchRooms();
    fetchBookings();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await fetch("/api/rooms");
      if (!response.ok) throw new Error("Failed to fetch rooms");
      const data = await response.json();
      setRooms(data.rooms);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      toast.error("Erro ao carregar salas");
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await fetch("/api/bookings");
      if (!response.ok) throw new Error("Failed to fetch bookings");
      const data = await response.json();
      setBookings(data.bookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      toast.error("Erro ao carregar agendamentos");
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || !newRoomCapacity) {
      toast.error("Preencha todos os campos");
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoomName,
          capacity: parseInt(newRoomCapacity),
        }),
      });

      if (!response.ok) throw new Error("Failed to create room");
      const newRoom = await response.json();
      setRooms((prev) => [...prev, newRoom]);
      setNewRoomName("");
      setNewRoomCapacity("");
      toast.success("Sala criada com sucesso!");
    } catch (error) {
      console.error("Error creating room:", error);
      toast.error("Erro ao criar sala");
    } finally {
      setIsLoading(false);
    }
  };

  const openEditRoomModal = (room: Room) => {
    setEditingRoom(room);
    setEditRoomName(room.name);
    setEditRoomCapacity(String(room.capacity));
    setEditRoomModalOpen(true);
  };

  const handleUpdateRoom = async () => {
    if (!editingRoom || !editRoomName.trim() || !editRoomCapacity) {
      toast.error("Preencha todos os campos");
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/rooms/${editingRoom.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editRoomName,
          capacity: parseInt(editRoomCapacity),
        }),
      });

      if (!response.ok) throw new Error("Failed to update room");
      const updatedRoom = await response.json();
      setRooms((prev) =>
        prev.map((r) => (r.id === editingRoom.id ? updatedRoom : r)),
      );
      setEditRoomModalOpen(false);
      setEditingRoom(null);
      toast.success("Sala atualizada com sucesso!");
    } catch (error) {
      console.error("Error updating room:", error);
      toast.error("Erro ao atualizar sala");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm("Tem certeza que deseja deletar esta sala?")) return;

    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete room");
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      toast.success("Sala deletada com sucesso!");
    } catch (error) {
      console.error("Error deleting room:", error);
      toast.error("Erro ao deletar sala");
    }
  };

  const openEditBookingModal = (booking: Booking) => {
    setEditingBooking(booking);
    setEditBookingName(booking.clientName);
    setEditBookingEmail(booking.clientEmail);
    setEditBookingDate(booking.date);
    setEditBookingStartTime(booking.startTime);
    setEditBookingEndTime(booking.endTime);
    setEditBookingRoomId(booking.roomId);
    setEditBookingModalOpen(true);
  };

  const validateDate = (dateStr: string): boolean => {
    // Validate YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return false;
    }

    const [year, month, day] = dateStr.split("-").map(Number);

    // Check if it's a valid calendar date
    const selectedDate = new Date(year, month - 1, day);
    if (
      selectedDate.getFullYear() !== year ||
      selectedDate.getMonth() !== month - 1 ||
      selectedDate.getDate() !== day
    ) {
      return false;
    }

    // Date must be today or in the future (no past dates)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    return selectedDate >= today;
  };

  const validateTime = (timeStr: string): boolean => {
    // Validate HH:mm format (00:00 to 23:59)
    if (!/^\d{2}:\d{2}$/.test(timeStr)) {
      return false;
    }

    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  };

  const validateTimeRange = (startTime: string, endTime: string): boolean => {
    // Both times must be valid format
    if (!validateTime(startTime) || !validateTime(endTime)) {
      return false;
    }

    // End time must be after start time
    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [endHours, endMinutes] = endTime.split(":").map(Number);

    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;

    return endTotalMinutes > startTotalMinutes;
  };

  const handleUpdateBooking = async () => {
    if (
      !editingBooking ||
      !editBookingName.trim() ||
      !editBookingEmail.trim() ||
      !editBookingDate ||
      !editBookingStartTime ||
      !editBookingEndTime
    ) {
      toast.error("Preencha todos os campos");
      return;
    }

    // Validate date
    if (!validateDate(editBookingDate)) {
      toast.error("Data inválida. A data deve ser hoje ou no futuro (formato: YYYY-MM-DD)");
      return;
    }

    // Validate time format
    if (!validateTime(editBookingStartTime)) {
      toast.error("Formato de horário de início inválido (use HH:mm)");
      return;
    }

    if (!validateTime(editBookingEndTime)) {
      toast.error("Formato de horário de término inválido (use HH:mm)");
      return;
    }

    // Validate time range
    if (!validateTimeRange(editBookingStartTime, editBookingEndTime)) {
      toast.error("Horário de término deve ser após o horário de início");
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`/api/bookings/${editingBooking.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: editBookingName,
          clientEmail: editBookingEmail,
          date: editBookingDate,
          startTime: editBookingStartTime,
          endTime: editBookingEndTime,
          roomId: editBookingRoomId,
        }),
      });

      if (!response.ok) throw new Error("Failed to update booking");
      const updatedBooking = await response.json();
      setBookings((prev) =>
        prev.map((b) => (b.id === editingBooking.id ? updatedBooking : b)),
      );
      setEditBookingModalOpen(false);
      setEditingBooking(null);
      toast.success("Agendamento atualizado com sucesso!");
    } catch (error) {
      console.error("Error updating booking:", error);
      toast.error("Erro ao atualizar agendamento");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!confirm("Tem certeza que deseja deletar este agendamento?")) return;

    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete booking");
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      toast.success("Agendamento deletado com sucesso!");
    } catch (error) {
      console.error("Error deleting booking:", error);
      toast.error("Erro ao deletar agendamento");
    }
  };

  const formatDate = (dateString: string) => {
    // Handle YYYY-MM-DD format without timezone conversion issues
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split("-");
      return `${day}/${month}/${year}`;
    }

    // Fallback for other formats
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const sortedBookings = [...bookings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Painel Administrativo
          </h1>
          <p className="text-muted-foreground">
            Gerencie salas e agendamentos com edição completa
          </p>
        </div>

        <Tabs defaultValue="rooms" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="rooms" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Salas</span>
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Agendamentos</span>
            </TabsTrigger>
          </TabsList>

          {/* Rooms Tab */}
          <TabsContent value="rooms" className="space-y-6">
            <Card className="p-6 border border-border">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                Criar Nova Sala
              </h2>
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input
                    type="text"
                    placeholder="Nome da sala (ex: Sala 101)"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="border-border focus:border-primary focus:ring-primary"
                  />
                  <Input
                    type="number"
                    placeholder="Capacidade"
                    value={newRoomCapacity}
                    onChange={(e) => setNewRoomCapacity(e.target.value)}
                    className="border-border focus:border-primary focus:ring-primary"
                  />
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Sala
                  </Button>
                </div>
              </form>
            </Card>

            {rooms.length === 0 ? (
              <Card className="p-8 text-center border border-border">
                <p className="text-muted-foreground">
                  Nenhuma sala cadastrada ainda.
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rooms.map((room) => (
                  <Card
                    key={room.id}
                    className="p-4 border border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">
                          {room.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Capacidade: {room.capacity} pessoas
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditRoomModal(room)}
                          className="text-primary hover:text-primary/80 hover:bg-primary/10"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRoom(room.id)}
                          className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings" className="space-y-6">
            {bookings.length === 0 ? (
              <Card className="p-8 text-center border border-border">
                <p className="text-muted-foreground">
                  Nenhum agendamento ainda.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {sortedBookings.map((booking) => (
                  <Card
                    key={booking.id}
                    className="p-4 border border-border hover:border-primary/50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                        <div>
                          <h3 className="font-semibold text-foreground">
                            {booking.roomName}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Agendado por: {booking.clientName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            E-mail: {booking.clientEmail}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            📅 {formatDate(booking.date)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            ⏰ {booking.startTime} - {booking.endTime}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Criado em:{" "}
                            {new Date(booking.createdAt).toLocaleString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditBookingModal(booking)}
                          className="text-primary hover:text-primary/80 hover:bg-primary/10"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteBooking(booking.id)}
                          className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Room Modal */}
      <Dialog open={editRoomModalOpen} onOpenChange={setEditRoomModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Sala</DialogTitle>
            <DialogDescription>
              Atualize as informações da sala
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-room-name">Nome da Sala</Label>
              <Input
                id="edit-room-name"
                value={editRoomName}
                onChange={(e) => setEditRoomName(e.target.value)}
                placeholder="Nome da sala"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-room-capacity">Capacidade</Label>
              <Input
                id="edit-room-capacity"
                type="number"
                value={editRoomCapacity}
                onChange={(e) => setEditRoomCapacity(e.target.value)}
                placeholder="Capacidade"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditRoomModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleUpdateRoom}
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90"
            >
              Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Booking Modal */}
      <Dialog
        open={editBookingModalOpen}
        onOpenChange={setEditBookingModalOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
            <DialogDescription>
              Atualize os detalhes do agendamento
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-booking-name">Nome do Cliente</Label>
              <Input
                id="edit-booking-name"
                value={editBookingName}
                onChange={(e) => setEditBookingName(e.target.value)}
                placeholder="Nome do cliente"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-booking-email">Email</Label>
              <Input
                id="edit-booking-email"
                type="email"
                value={editBookingEmail}
                onChange={(e) => setEditBookingEmail(e.target.value)}
                placeholder="Email"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="edit-booking-date">Data</Label>
              <Input
                id="edit-booking-date"
                type="date"
                value={editBookingDate}
                onChange={(e) => setEditBookingDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="edit-booking-start">Hora Início</Label>
                <Input
                  id="edit-booking-start"
                  type="time"
                  value={editBookingStartTime}
                  onChange={(e) => setEditBookingStartTime(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="edit-booking-end">Hora Fim</Label>
                <Input
                  id="edit-booking-end"
                  type="time"
                  value={editBookingEndTime}
                  onChange={(e) => setEditBookingEndTime(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-booking-room">Sala</Label>
              <select
                id="edit-booking-room"
                value={editBookingRoomId}
                onChange={(e) => setEditBookingRoomId(e.target.value)}
                className="w-full border rounded px-3 py-2 mt-1 bg-background border-border"
              >
                <option value="">Selecione uma sala</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditBookingModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleUpdateBooking}
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90"
            >
              Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
