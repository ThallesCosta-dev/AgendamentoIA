# Booking Lifecycle Testing Guide

This document describes how to test the complete booking lifecycle in the Agendamento de Salas application.

## Features Implemented

### 1. Create New Booking

- **UI Flow**: User interacts with chatbot to create new booking
- **Data Collection**: Name, Email, Date, Start Time, End Time, Room Selection
- **Validation**:
  - Email must be from Brazilian educational institution (.edu.br)
  - Time format validation (HH:mm)
  - Date format validation (YYYY-MM-DD or DD/MM/YYYY)
- **API Used**: `POST /api/bookings`
- **Success Result**: Displays booking ID with confirmation message

### 2. Display Booking ID

- **When**: After successful booking creation
- **Format**: "📌 **ID da Reserva: #[ID]**"
- **Message**: Includes all booking details and instructions to save ID for future modifications

### 3. Modify Existing Booking

- **Trigger**: User says "modificar", "editar", or "alterar"
- **Steps**:
  1. User provides booking ID (with or without #)
  2. System fetches current booking details via `GET /api/ai/bookings/{id}`
  3. System displays current details and asks which field to modify
  4. User selects field (Name, Email, Date, Time, Room)
  5. User provides new value
  6. System validates new value
  7. System updates via `PUT /api/ai/bookings/{id}`
  8. System confirms modification with updated details

- **Fields Modifiable**:
  - clientName (Name)
  - clientEmail (Email - must be .edu.br)
  - date (Date)
  - startTime (Start Time)
  - endTime (End Time)
  - roomId (Room - checks availability for selected date/time)

### 4. Cancel Booking

- **Trigger**: User says "cancelar", "cancel", or "remover"
- **Steps**:
  1. User provides booking ID
  2. System fetches booking details
  3. System asks for confirmation
  4. If confirmed: System deletes via `DELETE /api/ai/bookings/{id}`
  5. System confirms cancellation

## API Endpoints Used

### Booking Management

- `POST /api/bookings` - Create booking (main client endpoint)
- `POST /api/ai/bookings` - Create booking (AI endpoint)
- `GET /api/ai/bookings/{id}` - Get booking by ID
- `GET /api/ai/bookings` - List all bookings (with optional filters)
- `PUT /api/ai/bookings/{id}` - Modify booking
- `DELETE /api/ai/bookings/{id}` - Cancel booking
- `POST /api/ai/bookings/check-availability` - Check room availability

### Room Management

- `GET /api/ai/rooms` - List all available rooms

## Manual Testing Steps

### Test 1: Create a Booking

1. Go to Chatbot page
2. Enter your name (e.g., "João Silva")
3. Enter your institutional email (e.g., "joao.silva@university.edu.br")
4. Enter date in YYYY-MM-DD format (e.g., "2025-02-15")
5. Enter start time in HH:mm format (e.g., "10:00")
6. Enter end time in HH:mm format (e.g., "12:00")
7. Select a room from available options
8. Confirm with "Sim" or "Yes"
9. **Expected**: Booking created with ID displayed in confirmation message
10. **Save** the ID for next tests

### Test 2: Modify a Booking

1. In the same chatbot session, say "Quero modificar uma reserva"
2. Provide the booking ID from Test 1
3. Select the field to modify (e.g., "data")
4. Provide the new value
5. **Expected**: Booking updated successfully with new details

### Test 3: Cancel a Booking

1. In the chatbot, say "Quero cancelar uma reserva"
2. Provide the booking ID from Test 1
3. Confirm cancellation with "Sim"
4. **Expected**: Booking cancelled successfully

### Test 4: Validation Tests

- **Invalid Email**: Try creating booking with non-.edu.br email → Should be rejected
- **Invalid Dates**: Try with invalid date format → Should be handled gracefully
- **Non-existent ID**: Try to modify/cancel with wrong ID → Should show "not found" error

## Database Tables

### rooms

- id (INT, Primary Key)
- name (VARCHAR)
- capacity (INT)
- created_at (TIMESTAMP)

**Default Rooms**:

- Sala 101 (capacity: 30)
- Auditório Principal (capacity: 100)
- Sala de Conferência A (capacity: 20)

### bookings

- id (INT, Primary Key, Auto-increment)
- room_id (INT, Foreign Key)
- room_name (VARCHAR)
- client_name (VARCHAR)
- client_email (VARCHAR)
- date (DATE)
- start_time (TIME)
- end_time (TIME)
- created_at (TIMESTAMP)

## Key Implementation Details

### Email Validation

- Pattern: Must end with `.edu.br`
- Applied on: Booking creation, modification
- Pattern validation in both client and server

### AI System Prompt

Located in `server/routes/chat.ts`, includes:

- Complete API documentation
- Conversation flow
- Field validation rules
- Instructions for showing booking ID
- Instructions for modifications and cancellations

### State Management (Chatbot)

- `currentFlow`: Tracks whether in "booking", "modify", or "cancel" flow
- `currentBookingId`: Stores the ID of booking being modified/cancelled
- `currentBooking`: Stores fetched booking details
- `modificationField`: Tracks which field is being modified

## Troubleshooting

### "Email must be from a Brazilian educational institution"

- Ensure email ends with `.edu.br`
- Examples of valid emails:
  - `student@university.edu.br`
  - `professor@institute.edu.br`
  - `researcher@college.edu.br`

### "Room not found"

- Verify room ID is correct
- Check available rooms with: `GET /api/ai/rooms`

### "Booking not found"

- Verify booking ID is correct
- The ID is shown after successful creation

### "Failed to modify booking"

- Check if new email is valid (.edu.br)
- Check if date/time format is correct
- Verify room exists

## Performance Considerations

- Database queries are indexed on (room_id, date) for availability checks
- Email lookups are indexed on client_email
- All timestamps use UTC (created_at)
