import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Room, Booking } from "@shared/api";
import {
  Trash2,
  Plus,
  Calendar,
  Users,
  Edit,
  Archive,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { authFetch, readErrorMessage } from "@/lib/authFetch";

const ALL_MONTHS = "todos";

export default function Admin() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomCapacity, setNewRoomCapacity] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [selectedHistoryMonth, setSelectedHistoryMonth] =
    useState<string>(ALL_MONTHS);

  // Estado modal de edição de sala
  const [editRoomModalOpen, setEditRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [editRoomName, setEditRoomName] = useState("");
  const [editRoomCapacity, setEditRoomCapacity] = useState("");

  // Estado modal de edição de agendamento
  const [editBookingModalOpen, setEditBookingModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editBookingName, setEditBookingName] = useState("");
  const [editBookingEmail, setEditBookingEmail] = useState("");
  const [editBookingDate, setEditBookingDate] = useState("");
  const [editBookingStartTime, setEditBookingStartTime] = useState("");
  const [editBookingEndTime, setEditBookingEndTime] = useState("");
  const [editBookingRoomId, setEditBookingRoomId] = useState("");

  // Estado de confirmação de exclusão
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null);

  useEffect(() => {
    document.title = "Painel Administrativo — SalaAgenda";
  }, []);

  useEffect(() => {
    fetchRooms();
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSessionExpired = () => {
    toast.error("Sessão expirada, faça login novamente");
    logout();
    navigate("/login");
  };

  const fetchRooms = async () => {
    try {
      setIsLoadingRooms(true);
      const response = await authFetch(token, "/api/rooms");
      if (response.status === 401) {
        handleSessionExpired();
        return;
      }
      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "Erro ao carregar salas"),
        );
      }
      const data = await response.json();
      setRooms(data.rooms);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao carregar salas",
      );
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const fetchBookings = async () => {
    try {
      setIsLoadingBookings(true);
      const response = await authFetch(token, "/api/bookings");
      if (response.status === 401) {
        handleSessionExpired();
        return;
      }
      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "Erro ao carregar agendamentos"),
        );
      }
      const data = await response.json();
      setBookings(data.bookings);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao carregar agendamentos",
      );
    } finally {
      setIsLoadingBookings(false);
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
      const response = await authFetch(token, "/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoomName,
          capacity: parseInt(newRoomCapacity),
        }),
      });

      if (response.status === 401) {
        handleSessionExpired();
        return;
      }
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Erro ao criar sala"));
      }
      const newRoom = await response.json();
      setRooms((prev) => [...prev, newRoom]);
      setNewRoomName("");
      setNewRoomCapacity("");
      toast.success("Sala criada com sucesso!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao criar sala",
      );
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
      const response = await authFetch(token, `/api/rooms/${editingRoom.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editRoomName,
          capacity: parseInt(editRoomCapacity),
        }),
      });

      if (response.status === 401) {
        handleSessionExpired();
        return;
      }
      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "Erro ao atualizar sala"),
        );
      }
      const updatedRoom = await response.json();
      setRooms((prev) =>
        prev.map((r) => (r.id === editingRoom.id ? updatedRoom : r)),
      );
      setEditRoomModalOpen(false);
      setEditingRoom(null);
      toast.success("Sala atualizada com sucesso!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao atualizar sala",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    try {
      const response = await authFetch(token, `/api/rooms/${roomId}`, {
        method: "DELETE",
      });

      if (response.status === 401) {
        handleSessionExpired();
        return;
      }
      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "Erro ao excluir sala"),
        );
      }
      setRooms((prev) => prev.filter((r) => r.id !== roomId));
      toast.success("Sala excluída com sucesso!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao excluir sala",
      );
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
    // Validar formato YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return false;
    }

    const [year, month, day] = dateStr.split("-").map(Number);

    // Verificar se é uma data de calendário válida
    const selectedDate = new Date(year, month - 1, day);
    if (
      selectedDate.getFullYear() !== year ||
      selectedDate.getMonth() !== month - 1 ||
      selectedDate.getDate() !== day
    ) {
      return false;
    }

    // Data deve ser hoje ou no futuro (sem datas passadas)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    return selectedDate >= today;
  };

  const validateTime = (timeStr: string): boolean => {
    // Validar formato HH:mm (00:00 a 23:59)
    if (!/^\d{2}:\d{2}$/.test(timeStr)) {
      return false;
    }

    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  };

  const validateTimeRange = (startTime: string, endTime: string): boolean => {
    // Ambas as horas devem estar em formato válido
    if (!validateTime(startTime) || !validateTime(endTime)) {
      return false;
    }

    // Hora final deve ser depois da hora inicial
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

    // Validar data
    if (!validateDate(editBookingDate)) {
      toast.error(
        "Data inválida. A data deve ser hoje ou no futuro (formato: YYYY-MM-DD)",
      );
      return;
    }

    // Validar formato de hora
    if (!validateTime(editBookingStartTime)) {
      toast.error("Formato de horário de início inválido (use HH:mm)");
      return;
    }

    if (!validateTime(editBookingEndTime)) {
      toast.error("Formato de horário de término inválido (use HH:mm)");
      return;
    }

    // Validar intervalo de hora
    if (!validateTimeRange(editBookingStartTime, editBookingEndTime)) {
      toast.error("Horário de término deve ser após o horário de início");
      return;
    }

    try {
      setIsLoading(true);
      const response = await authFetch(
        token,
        `/api/bookings/${editingBooking.id}`,
        {
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
        },
      );

      if (response.status === 401) {
        handleSessionExpired();
        return;
      }
      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "Erro ao atualizar agendamento"),
        );
      }
      // Recarrega a lista para refletir os dados atualizados pelo servidor
      // (ex.: nome da sala)
      await fetchBookings();
      setEditBookingModalOpen(false);
      setEditingBooking(null);
      toast.success("Agendamento atualizado com sucesso!");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao atualizar agendamento",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    try {
      const response = await authFetch(token, `/api/bookings/${bookingId}`, {
        method: "DELETE",
      });

      if (response.status === 401) {
        handleSessionExpired();
        return;
      }
      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "Erro ao excluir agendamento"),
        );
      }
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      toast.success("Agendamento excluído com sucesso!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao excluir agendamento",
      );
    }
  };

  const formatDate = (dateString: string) => {
    // Lidar com formato YYYY-MM-DD sem problemas de conversão de fuso horário
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split("-");
      return `${day}/${month}/${year}`;
    }

    // Fallback para outros formatos
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const isBookingPast = (booking: Booking): boolean => {
    const [year, month, day] = booking.date.split("-").map(Number);
    const bookingDate = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    bookingDate.setHours(0, 0, 0, 0);
    return bookingDate < today;
  };

  const activeBookings = bookings.filter((b) => !isBookingPast(b));
  const pastBookings = bookings.filter((b) => isBookingPast(b));

  const sortedBookings = [...activeBookings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const getMonthsList = () => {
    const months = new Set<string>();
    pastBookings.forEach((booking) => {
      const [year, month] = booking.date.split("-");
      months.add(`${year}-${month}`);
    });
    return Array.from(months).sort().reverse();
  };

  const getFilteredHistoryBookings = () => {
    if (selectedHistoryMonth === ALL_MONTHS) {
      return [...pastBookings].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
    }

    const filtered = pastBookings.filter((booking) => {
      return booking.date.startsWith(selectedHistoryMonth);
    });

    return filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  };

  const getMonthLabel = (yearMonth: string) => {
    const [year, month] = yearMonth.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("pt-BR", {
      year: "numeric",
      month: "long",
    });
  };

  const renderLoadingCard = (message: string) => (
    <Card className="p-8 text-center border border-border">
      <div className="flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <p>{message}</p>
      </div>
    </Card>
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
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="rooms" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Salas</span>
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Agendamentos</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Archive className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
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
                    aria-label="Nome da sala"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="border-border focus:border-primary focus:ring-primary"
                  />
                  <Input
                    type="number"
                    placeholder="Capacidade"
                    aria-label="Capacidade da sala"
                    value={newRoomCapacity}
                    onChange={(e) => setNewRoomCapacity(e.target.value)}
                    className="border-border focus:border-primary focus:ring-primary"
                  />
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
                  >
                    {isLoading ? (
                      "Salvando..."
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar Sala
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Card>

            {isLoadingRooms ? (
              renderLoadingCard("Carregando salas...")
            ) : rooms.length === 0 ? (
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
                          aria-label={`Editar sala ${room.name}`}
                          className="text-primary hover:text-primary/80 hover:bg-primary/10"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRoomToDelete(room)}
                          aria-label={`Excluir sala ${room.name}`}
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
            {isLoadingBookings ? (
              renderLoadingCard("Carregando agendamentos...")
            ) : sortedBookings.length === 0 ? (
              <Card className="p-8 text-center border border-border">
                <p className="text-muted-foreground">
                  Nenhum agendamento ativo.
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
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-foreground">
                              {booking.roomName}
                            </h3>
                            <span className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground">
                              #{booking.id}
                            </span>
                          </div>
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
                          aria-label={`Editar agendamento ${booking.id}`}
                          className="text-primary hover:text-primary/80 hover:bg-primary/10"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setBookingToDelete(booking)}
                          aria-label={`Excluir agendamento ${booking.id}`}
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

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            {isLoadingBookings ? (
              renderLoadingCard("Carregando histórico...")
            ) : pastBookings.length === 0 ? (
              <Card className="p-8 text-center border border-border">
                <p className="text-muted-foreground">
                  Nenhum agendamento histórico ainda.
                </p>
              </Card>
            ) : (
              <>
                <Card className="p-4 border border-border">
                  <div className="flex items-center gap-4">
                    <label
                      htmlFor="history-month-filter"
                      className="text-sm font-medium text-foreground"
                    >
                      Filtrar por mês:
                    </label>
                    <Select
                      value={selectedHistoryMonth}
                      onValueChange={setSelectedHistoryMonth}
                    >
                      <SelectTrigger
                        id="history-month-filter"
                        className="w-full sm:w-64 border-border focus:border-primary focus:ring-primary"
                      >
                        <SelectValue placeholder="Todos os meses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL_MONTHS}>
                          Todos os meses
                        </SelectItem>
                        {getMonthsList().map((monthYear) => (
                          <SelectItem key={monthYear} value={monthYear}>
                            {getMonthLabel(monthYear)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </Card>

                <div className="space-y-4">
                  {getFilteredHistoryBookings().length === 0 ? (
                    <Card className="p-8 text-center border border-border">
                      <p className="text-muted-foreground">
                        Nenhum agendamento neste período.
                      </p>
                    </Card>
                  ) : (
                    getFilteredHistoryBookings().map((booking) => (
                      <Card
                        key={booking.id}
                        className="p-4 border border-border hover:border-primary/50 transition-colors opacity-75"
                      >
                        <div className="flex justify-between items-start">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold text-foreground">
                                  {booking.roomName}
                                </h3>
                                <span className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground">
                                  #{booking.id}
                                </span>
                              </div>
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
                                {new Date(booking.createdAt).toLocaleString(
                                  "pt-BR",
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setBookingToDelete(booking)}
                              aria-label={`Excluir agendamento ${booking.id}`}
                              className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </>
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
              {isLoading ? "Atualizando..." : "Atualizar"}
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
              {isLoading ? "Atualizando..." : "Atualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão de sala */}
      <AlertDialog
        open={!!roomToDelete}
        onOpenChange={(open) => {
          if (!open) setRoomToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sala</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a sala{" "}
              {roomToDelete ? `"${roomToDelete.name}"` : "selecionada"}? Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (roomToDelete) {
                  handleDeleteRoom(roomToDelete.id);
                }
                setRoomToDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de exclusão de agendamento */}
      <AlertDialog
        open={!!bookingToDelete}
        onOpenChange={(open) => {
          if (!open) setBookingToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o agendamento{" "}
              {bookingToDelete
                ? `#${bookingToDelete.id} (${bookingToDelete.roomName})`
                : "selecionado"}
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (bookingToDelete) {
                  handleDeleteBooking(bookingToDelete.id);
                }
                setBookingToDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
