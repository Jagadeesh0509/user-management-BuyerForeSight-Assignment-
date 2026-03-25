# User Management REST API

Simple Express-based REST API for managing users, built for the BuyerForeSight backend assignment.

## Tech stack

* Node.js
* Express
* JSON file storage

## Setup

```bash
npm install
npm start
```

The server runs on `http://localhost:3000` by default.

## API endpoints

### `GET /users`

List all users.

Optional query params:

* `search`: filters by `name` or `email`
* `sort`: one of `name`, `email`, `createdAt`, `updatedAt`
* `order`: `asc` or `desc`

Example:

```bash
GET /users?search=jane&sort=name&order=asc
```

### `GET /users/:id`

Fetch a single user by id.

### `POST /users`

Create a user.

Sample body:

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "age": 28
}
```

### `PUT /users/:id`

Replace a user's editable fields.

Sample body:

```json
{
  "name": "Jane Smith",
  "email": "jane.smith@example.com",
  "age": 29
}
```

### `DELETE /users/:id`

Delete a user by id.

## Testing

API requests are tested using a `requests.http` file (compatible with the VS Code REST Client extension).
It includes:

* CRUD operations
* Validation scenarios
* Search and sorting tests
* Error handling cases

## Notes

* User data persists in `data/users.json`
* Emails must be unique
* `age` is optional but must be a non-negative integer if provided
