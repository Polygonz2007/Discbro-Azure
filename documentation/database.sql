-- Users Table
CREATE TABLE users (
    id INT PRIMARY KEY IDENTITY(1,1), -- Auto-increment
    username NVARCHAR(32) UNIQUE, -- Username, unique, min length 4 (will enforce this with a CHECK constraint)
    display_name NVARCHAR(48), -- Display name
    password NVARCHAR(60), -- Password hash
    status INT, -- Status: 0: offline, 1: online, 2: inactive, etc.
    status_text NVARCHAR(128), -- Temporary status text
    bio NVARCHAR(512), -- Bio description
    profile_picture NVARCHAR(128), -- Profile picture path
    theme TINYINT, -- Theme: 0: dark (default), 1: midnight, 2: light, etc.
    created_time BIGINT NOT NULL DEFAULT DATEDIFF(SECOND, '19700101', GETDATE()), -- Unix timestamp
    CONSTRAINT CHK_username_length CHECK (LEN(username) >= 4) -- Enforce minimum length for username
);

-- Friends Table
CREATE TABLE friends (
    id INT PRIMARY KEY IDENTITY(1,1), -- Auto-increment
    user1_id INT NOT NULL, -- User 1 (request sender)
    user2_id INT NOT NULL, -- User 2 (request recipient)
    status TINYINT, -- Status: 0: pending, 1: accepted
    CONSTRAINT FK_user1 FOREIGN KEY (user1_id) REFERENCES users(id),
    CONSTRAINT FK_user2 FOREIGN KEY (user2_id) REFERENCES users(id)
);

-- Servers Table
CREATE TABLE servers (
    id INT PRIMARY KEY IDENTITY(1,1), -- Auto-increment
    name NVARCHAR(64) NOT NULL, -- Server name
    icon NVARCHAR(128), -- Icon path, if null, use default
    created_time BIGINT NOT NULL DEFAULT DATEDIFF(SECOND, '19700101', GETDATE()), -- Unix timestamp
);

-- Members Table
CREATE TABLE members (
    id INT PRIMARY KEY IDENTITY(1,1), -- Auto-increment
    server_id INT NOT NULL, -- Server ID
    user_id INT NOT NULL, -- User ID
    joined_time BIGINT NOT NULL DEFAULT DATEDIFF(SECOND, '19700101', GETDATE()), -- Unix timestamp
    CONSTRAINT FK_server FOREIGN KEY (server_id) REFERENCES servers(id),
    CONSTRAINT FK_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Categories Table
CREATE TABLE categories (
    id INT PRIMARY KEY IDENTITY(1,1), -- Auto-increment
    name NVARCHAR(63) NOT NULL, -- Category name
    server_id INT NOT NULL, -- Server ID
    CONSTRAINT FK_category_server FOREIGN KEY (server_id) REFERENCES servers(id)
);

-- Channels Table
CREATE TABLE channels (
    id INT PRIMARY KEY IDENTITY(1,1), -- Auto-increment
    name NVARCHAR(63) NOT NULL, -- Channel name
    server_id INT NOT NULL, -- Server ID
    category_id INT, -- Category ID (nullable)
    created_time BIGINT NOT NULL DEFAULT DATEDIFF(SECOND, '19700101', GETDATE()), -- Unix timestamp
    CONSTRAINT FK_channel_server FOREIGN KEY (server_id) REFERENCES servers(id),
    CONSTRAINT FK_channel_category FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Messages Table
CREATE TABLE messages (
    id INT PRIMARY KEY IDENTITY(1,1), -- Auto-increment
    channel_id INT NOT NULL, -- Channel ID
    author_id INT NOT NULL, -- Author (user) ID
    content NVARCHAR(2048) NOT NULL, -- Message content
    time BIGINT NOT NULL DEFAULT DATEDIFF(SECOND, '19700101', GETDATE()), -- Unix timestamp
    CONSTRAINT FK_message_channel FOREIGN KEY (channel_id) REFERENCES channels(id),
    CONSTRAINT FK_message_author FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Init Data
INSERT INTO servers (name) VALUES ('Global');
INSERT INTO channels (name, server_id) VALUES ('channel 1', 1);
