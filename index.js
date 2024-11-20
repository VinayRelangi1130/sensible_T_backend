const express = require("express"); 
const path = require("path");
const cors = require("cors");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express(); 
// express instance

app.use(cors());
app.use(express.json());  
// middleware function 

const dbPath = path.join(__dirname, "database.db");

let db = null;

const initializeDBAndServer = async () => {
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        app.listen(3000, () => {
            console.log("Server is Running at http://localhost:3000/");
        });
    } catch (e) {
        console.log(`DB Error: ${e.message}`);
        process.exit(1);
    }
}


initializeDBAndServer();

// POST /api/transactions/ - Create a new transaction
app.post("/api/transactions/", async (req, res) => {
    const { amount, transaction_type, user } = req.body;

    if (!["DEPOSIT", "WITHDRAWAL"].includes(transaction_type)) {
        return res.status(400).send({ error: "Invalid transaction_type." });
    }

    try {
        const query = `
            INSERT INTO transactions (amount, transaction_type, user, status)
            VALUES (?, ?, ?, 'PENDING');
        `;
        const result = await db.run(query, [amount, transaction_type, user]);

        const transaction = {
            transaction_id: result.lastID,
            amount,
            transaction_type,
            status: "PENDING",
            user,
            timestamp: new Date().toISOString(),
        };

        res.status(201).send(transaction);
    } catch (error) {
        res.status(500).send({ error: "Error creating transaction." });
    }
});

// GET /api/transactions/ - Retrieve all transactions for a user
app.get("/api/transactions/", async (req, res) => {
    const { user_id } = req.query;
    console.log(user_id);

    if (!user_id) {
        return res.status(400).send({ error: "User ID is required." });
    }

    try {
        const query = `
            SELECT transaction_id, amount, transaction_type, status, timestamp FROM transactions
            WHERE user = ?;
        `;
        const transactions = await db.all(query, [user_id]);

        res.send({ transactions });
    } catch (error) {
        res.status(500).send({ error: "Error retrieving transactions." });
    }
});

// PUT /api/transactions/:transaction_id/ - Update transaction status
app.put("/api/transactions/:transaction_id/", async (req, res) => {
    const { transaction_id } = req.params;
    const { status } = req.body;

    if (!["COMPLETED", "FAILED"].includes(status)) {
        return res.status(400).send({ error: "Invalid status value." });
    }

    try {
        const updateQuery = `
            UPDATE transactions
            SET status = ?
            WHERE transaction_id = ?;
        `;
        const result = await db.run(updateQuery, [status, transaction_id]);

        if (result.changes === 0) {
            return res.status(404).send({ error: "Transaction not found." });
        }

        const updatedTransaction = await db.get(
            `SELECT transaction_id, amount, transaction_type, status, timestamp FROM transactions WHERE transaction_id = ?;`,
            [transaction_id]
        );

        res.send(updatedTransaction);
    } catch (error) {
        res.status(500).send({ error: "Error updating transaction." });
    }
});

// GET /api/transactions/:transaction_id/ - Get details of a specific transaction
app.get("/api/transactions/:transaction_id/", async (req, res) => {
    const { transaction_id } = req.params;

    try {
        const query = `
            SELECT transaction_id, amount, transaction_type, status, timestamp FROM transactions
            WHERE transaction_id = ?;
        `;
        const transaction = await db.get(query, [transaction_id]);

        if (!transaction) {
            return res.status(404).send({ error: "Transaction not found." });
        }

        res.send(transaction);
    } catch (error) {
        res.status(500).send({ error: "Error retrieving transaction." });
    }
});
