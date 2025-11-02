import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Room, Booking } from "@shared/api";
import { Trash2, Plus, Calendar, Users } from "lucide-react";
import { toast } from "sonner";

export default function Admin() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomCapacity, setNewRoomCapacity] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const sortedBookings = [...bookings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Painel Administrativo</h1>
          <p className="text-muted-foreground">Gerencie salas e agendamentos</p>
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
              <h2 className="text-xl font-semibold text-foreground mb-4">Criar Nova Sala</h2>
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
                <p className="text-muted-foreground">Nenhuma sala cadastrada ainda.</p>
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
                        <h3 className="font-semibold text-foreground">{room.name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Capacidade: {room.capacity} pessoas
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRoom(room.id)}
                        className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
                <p className="text-muted-foreground">Nenhum agendamento ainda.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                {sortedBookings.map((booking) => (
                  <Card key={booking.id} className="p-4 border border-border hover:border-primary/50 transition-colors">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-semibold text-foreground">{booking.roomName}</h3>
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
                          Criado em: {new Date(booking.createdAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
