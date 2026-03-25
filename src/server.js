const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "users.json");
const ALLOWED_SORT_FIELDS = new Set(["name", "email", "createdAt", "updatedAt"]);

app.use(express.json());

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]");
  }
}

async function readUsers() {
  await ensureDataFile();
  const fileContent = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(fileContent);
}

async function writeUsers(users) {
  await fs.writeFile(DATA_FILE, JSON.stringify(users, null, 2));
}

function normalizeUserPayload(payload) {
  const safePayload = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};

  return {
    name: typeof safePayload.name === "string" ? safePayload.name.trim() : "",
    email: typeof safePayload.email === "string" ? safePayload.email.trim().toLowerCase() : "",
    age: safePayload.age
  };
}

function validateUserPayload(payload) {
  const errors = [];

  if (!payload.name) {
    errors.push("name is required");
  }

  if (!payload.email) {
    errors.push("email is required");
  } else {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(payload.email)) {
      errors.push("email must be a valid email address");
    }
  }

  if (payload.age !== undefined) {
    if (!Number.isInteger(payload.age) || payload.age < 0) {
      errors.push("age must be a non-negative integer");
    }
  }

  return errors;
}

function applyFiltersAndSort(users, query) {
  let result = [...users];

  if (query.search) {
    const searchTerm = String(query.search).trim().toLowerCase();
    result = result.filter((user) => {
      return user.name.toLowerCase().includes(searchTerm) || user.email.toLowerCase().includes(searchTerm);
    });
  }

  if (query.sort) {
    const sortField = String(query.sort);
    const order = String(query.order || "asc").toLowerCase() === "desc" ? "desc" : "asc";

    if (!ALLOWED_SORT_FIELDS.has(sortField)) {
      const supported = Array.from(ALLOWED_SORT_FIELDS).join(", ");
      const error = new Error(`sort must be one of: ${supported}`);
      error.statusCode = 400;
      throw error;
    }

    result.sort((a, b) => {
      const left = String(a[sortField] ?? "").toLowerCase();
      const right = String(b[sortField] ?? "").toLowerCase();

      if (left < right) {
        return order === "asc" ? -1 : 1;
      }

      if (left > right) {
        return order === "asc" ? 1 : -1;
      }

      return 0;
    });
  }

  return result;
}

async function ensureUniqueEmail(email, existingId) {
  const users = await readUsers();
  const duplicate = users.find((user) => user.email === email && user.id !== existingId);

  if (duplicate) {
    const error = new Error("email must be unique");
    error.statusCode = 409;
    throw error;
  }
}

app.get("/users", async (req, res, next) => {
  try {
    const users = await readUsers();
    const filteredUsers = applyFiltersAndSort(users, req.query);
    res.status(200).json(filteredUsers);
  } catch (error) {
    next(error);
  }
});

app.get("/users/:id", async (req, res, next) => {
  try {
    const users = await readUsers();
    const user = users.find((entry) => entry.id === req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
});

app.post("/users", async (req, res, next) => {
  try {
    const payload = normalizeUserPayload(req.body);
    const validationErrors = validateUserPayload(payload);

    if (validationErrors.length > 0) {
      return res.status(400).json({ message: "Validation failed", errors: validationErrors });
    }

    await ensureUniqueEmail(payload.email);

    const users = await readUsers();
    const timestamp = new Date().toISOString();

    const newUser = {
      id: crypto.randomUUID(),
      ...payload,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    users.push(newUser);
    await writeUsers(users);

    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
});

app.put("/users/:id", async (req, res, next) => {
  try {
    const payload = normalizeUserPayload(req.body);
    const validationErrors = validateUserPayload(payload);

    if (validationErrors.length > 0) {
      return res.status(400).json({ message: "Validation failed", errors: validationErrors });
    }

    const users = await readUsers();
    const userIndex = users.findIndex((entry) => entry.id === req.params.id);

    if (userIndex === -1) {
      return res.status(404).json({ message: "User not found" });
    }

    await ensureUniqueEmail(payload.email, req.params.id);

    const updatedUser = {
      ...users[userIndex],
      ...payload,
      updatedAt: new Date().toISOString()
    };

    users[userIndex] = updatedUser;
    await writeUsers(users);

    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
});

app.delete("/users/:id", async (req, res, next) => {
  try {
    const users = await readUsers();
    const userIndex = users.findIndex((entry) => entry.id === req.params.id);

    if (userIndex === -1) {
      return res.status(404).json({ message: "User not found" });
    }

    const [deletedUser] = users.splice(userIndex, 1);
    await writeUsers(users);

    res.status(200).json({ message: "User deleted successfully", user: deletedUser });
  } catch (error) {
    next(error);
  }
});

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    message: err.message || "Internal server error"
  });
});

ensureDataFile()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`User Management API is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize data storage", error);
    process.exit(1);
  });
