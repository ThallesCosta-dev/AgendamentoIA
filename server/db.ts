import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "test",
  port: parseInt(process.env.DB_PORT || "3306"),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
});

export async function initializeDatabase() {
  const connection = await pool.getConnection();
  try {
    // Cria tabela de salas se não existir
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        capacity INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Cria tabela de agendamentos se não existir
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        room_name VARCHAR(255) NOT NULL,
        client_name VARCHAR(255) NOT NULL,
        client_email VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id),
        INDEX idx_room_date (room_id, date),
        INDEX idx_email (client_email)
      )
    `);

    // Cria tabela de logs de emails se não existir
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email_id VARCHAR(255) UNIQUE NOT NULL,
        sender_email VARCHAR(255) NOT NULL,
        subject VARCHAR(500),
        received_at DATETIME NOT NULL,
        processed_at DATETIME,
        classification ENUM('INFORMATION_REQUEST', 'BOOKING_REQUEST', 'UNCLEAR') NOT NULL,
        confidence DECIMAL(3,2),
        extracted_data JSON,
        action_taken ENUM('PROCESSED_BOOKING', 'SENT_RESPONSE', 'FAILED') NOT NULL,
        booking_id VARCHAR(255),
        processing_time_ms INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sender (sender_email),
        INDEX idx_received (received_at),
        INDEX idx_classification (classification)
      )
    `);

    // Cria tabela de respostas de emails se não existir
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS email_responses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email_log_id INT NOT NULL,
        response_type ENUM('INFORMATION', 'INCOMPLETE_BOOKING', 'CONFIRMATION', 'ERROR') NOT NULL,
        response_content TEXT NOT NULL,
        sent_at DATETIME NOT NULL,
        successfully_sent BOOLEAN DEFAULT TRUE,
        error_message TEXT,
        FOREIGN KEY (email_log_id) REFERENCES email_logs(id),
        INDEX idx_email_log (email_log_id),
        INDEX idx_response_type (response_type),
        INDEX idx_sent_at (sent_at)
      )
    `);

    // Verifica se as salas padrão existem
    const [existingRooms] = await connection.execute<any[]>(
      "SELECT COUNT(*) as count FROM rooms",
    );

    if (existingRooms[0].count === 0) {
      // Insere salas padrão
      await connection.execute(
        "INSERT INTO rooms (name, capacity) VALUES (?, ?)",
        ["Sala 101", 30],
      );
      await connection.execute(
        "INSERT INTO rooms (name, capacity) VALUES (?, ?)",
        ["Auditório Principal", 100],
      );
      await connection.execute(
        "INSERT INTO rooms (name, capacity) VALUES (?, ?)",
        ["Sala de Conferência A", 20],
      );
      console.log("Default rooms created");
    }

    console.log("✅ Database tables initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize database:", error);
    throw error;
  } finally {
    connection.release();
  }
}

export async function getConnection() {
  return pool.getConnection();
}

export default pool;
