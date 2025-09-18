import sqlite3 from 'sqlite3';
import path from 'path';

// Database path
const dbPath = path.join(process.cwd(), 'lottery_plays.db');

// Interface for lottery play data
export interface LotteryPlay {
  id?: number;
  username: string;
  profileImage?: string;
  numbers: number[];
  timestamp: Date;
  message: string;
  walletAddress?: string;
}

// Interface for database row
interface LotteryPlayRow {
  id: number;
  username: string;
  profile_image: string | null;
  numbers: string;
  timestamp: string;
  message: string;
  wallet_address: string | null;
}

// Interface for count query result
interface CountRow {
  count: number;
}

// Interface for lottery result data
export interface LotteryResult {
  id?: number;
  winning_numbers: number[];
  draw_timestamp: Date;
  total_players: number;
  total_winners: number;
  jackpot_amount: string;
  source_table: 'lottery_plays' | 'lottery_plays_home';
}

// Interface for lottery winner data
export interface LotteryWinner {
  id?: number;
  username: string;
  profileImage?: string;
  numbers: number[];
  timestamp: Date;
  message: string;
  walletAddress?: string;
  txs?: string;
}

// Interface for config data
export interface Config {
  id?: number;
  key: string;
  value: string;
  updated_at: Date;
}

// Interface for database row - config
interface ConfigRow {
  id: number;
  key: string;
  value: string;
  updated_at: string;
}

// Interface for database row - lottery results
interface LotteryResultRow {
  id: number;
  winning_numbers: string;
  draw_timestamp: string;
  total_players: number;
  total_winners: number;
  jackpot_amount: string;
  source_table: string;
}

// Interface for database row - lottery winners
interface LotteryWinnerRow {
  id: number;
  username: string;
  profile_image: string | null;
  numbers: string;
  timestamp: string;
  message: string;
  wallet_address: string | null;
  txs: string | null;
}

// Interface for whitelist data
export interface Whitelist {
  id?: number;
  wallet_address: string;
  created_at: Date;
  is_active: boolean;
}

// Interface for database row - whitelist
interface WhitelistRow {
  id: number;
  wallet_address: string;
  created_at: string;
  is_active: number;
}

// Initialize database and create tables if not exists
export function initDatabase(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Create lottery_plays table if not exists
      db.run(`
        CREATE TABLE IF NOT EXISTS lottery_plays (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          profile_image TEXT,
          numbers TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          message TEXT NOT NULL,
          wallet_address TEXT
        )
      `, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Create lottery_plays_home table if not exists
        db.run(`
          CREATE TABLE IF NOT EXISTS lottery_plays_home (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            profile_image TEXT,
            numbers TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            message TEXT NOT NULL,
            wallet_address TEXT
          )
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Create lottery_results table if not exists
          db.run(`
            CREATE TABLE IF NOT EXISTS lottery_results (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              winning_numbers TEXT NOT NULL,
              draw_timestamp TEXT NOT NULL,
              total_players INTEGER DEFAULT 0,
              total_winners INTEGER DEFAULT 0,
              jackpot_amount TEXT DEFAULT '0',
              source_table TEXT DEFAULT 'lottery_plays_home'
            )
          `, (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            // Create lottery_winners table if not exists
            db.run(`
              CREATE TABLE IF NOT EXISTS lottery_winners (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                profile_image TEXT,
                numbers TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                message TEXT NOT NULL,
                wallet_address TEXT,
                txs TEXT
              )
            `, (err) => {
              if (err) {
                reject(err);
                return;
              }
              
              // Add txs column if it doesn't exist (for existing databases)
              db.run(`
                ALTER TABLE lottery_winners ADD COLUMN txs TEXT
              `, (alterErr) => {
                // Ignore error if column already exists
                if (alterErr && !alterErr.message.includes('duplicate column')) {
                  console.warn('Warning: Could not add txs column:', alterErr.message);
                }
                
                // Continue with creating config table
                createConfigTable();
              });
              
              function createConfigTable() {
                // Create config table if not exists
                db.run(`
                  CREATE TABLE IF NOT EXISTS config (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT UNIQUE NOT NULL,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                  )
                `, (err) => {
                  if (err) {
                    reject(err);
                    return;
                  }
                  
                  // Create whitelist table if not exists
                  db.run(`
                    CREATE TABLE IF NOT EXISTS whitelist (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      wallet_address TEXT UNIQUE NOT NULL,
                      created_at TEXT NOT NULL,
                      is_active INTEGER DEFAULT 1
                    )
                  `, (err) => {
                    if (err) {
                      reject(err);
                    } else {
                      resolve(db);
                    }
                  });
                });
              }
            });
          });
        });
      });
    });
  });
}

// Save a lottery play to the database
export async function saveLotteryPlay(play: Omit<LotteryPlay, 'id'>): Promise<number> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      // First, delete any existing entries with the same username or wallet_address
      const deleteStmt = db.prepare(`
        DELETE FROM lottery_plays 
        WHERE username = ? OR (wallet_address IS NOT NULL AND wallet_address = ?)
      `);
      
      deleteStmt.run([
        play.username,
        play.walletAddress || null
      ], function(deleteErr) {
        if (deleteErr) {
          reject(deleteErr);
          return;
        }
        
        // If any rows were deleted, log the action
        if (this.changes > 0) {
          console.log(`Removed ${this.changes} existing lottery play(s) for username: ${play.username} or wallet: ${play.walletAddress}`);
        }
        
        deleteStmt.finalize();
        
        // Now insert the new data
        const insertStmt = db.prepare(`
          INSERT INTO lottery_plays (username, profile_image, numbers, timestamp, message, wallet_address)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        insertStmt.run([
          play.username,
          play.profileImage || null,
          JSON.stringify(play.numbers),
          play.timestamp.toISOString(),
          play.message,
          play.walletAddress || null
        ], function(insertErr) {
          if (insertErr) {
            reject(insertErr);
          } else {
            resolve(this.lastID);
          }
          insertStmt.finalize();
          db.close();
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Retrieve recent lottery plays from the database
export async function getRecentLotteryPlays(limit: number = 10): Promise<LotteryPlay[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      db.all(`
        SELECT * FROM lottery_plays 
        ORDER BY timestamp DESC 
        LIMIT ?
      `, [limit], (err, rows: LotteryPlayRow[]) => {
        if (err) {
          reject(err);
        } else {
          const plays: LotteryPlay[] = rows.map(row => ({
            id: row.id,
            username: row.username,
            profileImage: row.profile_image || undefined,
            numbers: JSON.parse(row.numbers),
            timestamp: new Date(row.timestamp),
            message: row.message,
            walletAddress: row.wallet_address || undefined
          }));
          resolve(plays);
        }
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Retrieve paginated lottery plays from the database
export async function getPaginatedLotteryPlays(page: number = 1, limit: number = 10): Promise<{plays: LotteryPlay[], total: number, totalPages: number}> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      const offset = (page - 1) * limit;
      
      // Get total count
      db.get(`SELECT COUNT(*) as count FROM lottery_plays`, [], (err, countRow: {count: number}) => {
        if (err) {
          reject(err);
          db.close();
          return;
        }
        
        const total = countRow.count;
        const totalPages = Math.ceil(total / limit);
        
        // Get paginated results
        db.all(`
          SELECT * FROM lottery_plays 
          ORDER BY timestamp DESC 
          LIMIT ? OFFSET ?
        `, [limit, offset], (err, rows: LotteryPlayRow[]) => {
          if (err) {
            reject(err);
          } else {
            const plays: LotteryPlay[] = rows.map(row => ({
              id: row.id,
              username: row.username,
              profileImage: row.profile_image || undefined,
              numbers: JSON.parse(row.numbers),
              timestamp: new Date(row.timestamp),
              message: row.message,
              walletAddress: row.wallet_address || undefined
            }));
            resolve({ plays, total, totalPages });
          }
          db.close();
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Get lottery plays by username
export async function getLotteryPlaysByUser(username: string): Promise<LotteryPlay[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      db.all(`
        SELECT * FROM lottery_plays 
        WHERE username = ? 
        ORDER BY timestamp DESC
      `, [username], (err, rows: LotteryPlayRow[]) => {
        if (err) {
          reject(err);
        } else {
          const plays: LotteryPlay[] = rows.map(row => ({
            id: row.id,
            username: row.username,
            profileImage: row.profile_image || undefined,
            numbers: JSON.parse(row.numbers),
            timestamp: new Date(row.timestamp),
            message: row.message,
            walletAddress: row.wallet_address || undefined
          }));
          resolve(plays);
        }
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Get total count of lottery plays
export async function getLotteryPlaysCount(): Promise<number> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      db.get(`SELECT COUNT(*) as count FROM lottery_plays`, (err, row: CountRow) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count);
        }
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// ========== HOME LOTTERY PLAYS FUNCTIONS ==========

// Save a lottery play to the home database
export async function saveLotteryPlayHome(play: Omit<LotteryPlay, 'id'>): Promise<number> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      // First, delete any existing entries with the same username or wallet_address
      const deleteStmt = db.prepare(`
        DELETE FROM lottery_plays_home 
        WHERE username = ? OR (wallet_address IS NOT NULL AND wallet_address = ?)
      `);
      
      deleteStmt.run([
        play.username,
        play.walletAddress || null
      ], function(deleteErr) {
        if (deleteErr) {
          reject(deleteErr);
          return;
        }
        
        // If any rows were deleted, log the action
        if (this.changes > 0) {
          console.log(`Removed ${this.changes} existing home lottery play(s) for username: ${play.username} or wallet: ${play.walletAddress}`);
        }
        
        deleteStmt.finalize();
        
        // Now insert the new data
        const insertStmt = db.prepare(`
          INSERT INTO lottery_plays_home (username, profile_image, numbers, timestamp, message, wallet_address)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        insertStmt.run([
          play.username,
          play.profileImage || null,
          JSON.stringify(play.numbers),
          play.timestamp.toISOString(),
          play.message,
          play.walletAddress || null
        ], function(insertErr) {
          if (insertErr) {
            reject(insertErr);
          } else {
            resolve(this.lastID);
          }
          insertStmt.finalize();
          db.close();
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Retrieve recent lottery plays from the home database
export async function getRecentLotteryPlaysHome(limit: number = 10): Promise<LotteryPlay[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      db.all(`
        SELECT * FROM lottery_plays_home 
        ORDER BY timestamp DESC 
        LIMIT ?
      `, [limit], (err, rows: LotteryPlayRow[]) => {
        if (err) {
          reject(err);
        } else {
          const plays: LotteryPlay[] = rows.map(row => ({
            id: row.id,
            username: row.username,
            profileImage: row.profile_image || undefined,
            numbers: JSON.parse(row.numbers),
            timestamp: new Date(row.timestamp),
            message: row.message,
            walletAddress: row.wallet_address || undefined
          }));
          resolve(plays);
        }
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Get home lottery plays by username
export async function getLotteryPlaysByUserHome(username: string): Promise<LotteryPlay[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      db.all(`
        SELECT * FROM lottery_plays_home 
        WHERE username = ? 
        ORDER BY timestamp DESC
      `, [username], (err, rows: LotteryPlayRow[]) => {
        if (err) {
          reject(err);
        } else {
          const plays: LotteryPlay[] = rows.map(row => ({
            id: row.id,
            username: row.username,
            profileImage: row.profile_image || undefined,
            numbers: JSON.parse(row.numbers),
            timestamp: new Date(row.timestamp),
            message: row.message,
            walletAddress: row.wallet_address || undefined
          }));
          resolve(plays);
        }
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Get total count of home lottery plays
export async function getLotteryPlaysCountHome(): Promise<number> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      db.get(`SELECT COUNT(*) as count FROM lottery_plays_home`, (err, row: CountRow) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count);
        }
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Update a lottery play in the home database
export async function updateLotteryPlayHome(id: number, play: Omit<LotteryPlay, 'id'>): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      const stmt = db.prepare(`
        UPDATE lottery_plays_home 
        SET username = ?, profile_image = ?, numbers = ?, timestamp = ?, message = ?, wallet_address = ?
        WHERE id = ?
      `);
      
      stmt.run([
        play.username,
        play.profileImage || null,
        JSON.stringify(play.numbers),
        play.timestamp.toISOString(),
        play.message,
        play.walletAddress || null,
        id
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
        stmt.finalize();
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Delete a lottery play from the home database
export async function deleteLotteryPlayHome(id: number): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      db.run(`DELETE FROM lottery_plays_home WHERE id = ?`, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Update a lottery play in the main database
export async function updateLotteryPlay(id: number, play: Omit<LotteryPlay, 'id'>): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      const stmt = db.prepare(`
        UPDATE lottery_plays 
        SET username = ?, profile_image = ?, numbers = ?, timestamp = ?, message = ?, wallet_address = ?
        WHERE id = ?
      `);
      
      stmt.run([
        play.username,
        play.profileImage || null,
        JSON.stringify(play.numbers),
        play.timestamp.toISOString(),
        play.message,
        play.walletAddress || null,
        id
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
        stmt.finalize();
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Delete a lottery play from the main database
export async function deleteLotteryPlay(id: number): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      db.run(`DELETE FROM lottery_plays WHERE id = ?`, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// ========== LOTTERY RESULTS FUNCTIONS ==========

// Save a lottery result to the database
export async function saveLotteryResult(result: Omit<LotteryResult, 'id'>): Promise<number> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      const stmt = db.prepare(`
        INSERT INTO lottery_results (winning_numbers, draw_timestamp, total_players, total_winners, jackpot_amount, source_table)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        JSON.stringify(result.winning_numbers),
        result.draw_timestamp.toISOString(),
        result.total_players,
        result.total_winners,
        result.jackpot_amount,
        result.source_table
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
        stmt.finalize();
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Get recent lottery results
export async function getRecentLotteryResults(limit: number = 10): Promise<LotteryResult[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      db.all(`
        SELECT * FROM lottery_results 
        ORDER BY draw_timestamp DESC 
        LIMIT ?
      `, [limit], (err, rows: LotteryResultRow[]) => {
        if (err) {
          reject(err);
        } else {
          const results: LotteryResult[] = rows.map(row => ({
            id: row.id,
            winning_numbers: JSON.parse(row.winning_numbers),
            draw_timestamp: new Date(row.draw_timestamp),
            total_players: row.total_players,
            total_winners: row.total_winners,
            jackpot_amount: row.jackpot_amount,
            source_table: row.source_table as 'lottery_plays' | 'lottery_plays_home'
          }));
          resolve(results);
        }
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// ========== LOTTERY WINNERS FUNCTIONS ==========

// Save a lottery winner to the database
export async function saveLotteryWinner(winner: Omit<LotteryWinner, 'id'>): Promise<number> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      const stmt = db.prepare(`
        INSERT INTO lottery_winners (username, profile_image, numbers, timestamp, message, wallet_address, txs)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        winner.username,
        winner.profileImage || null,
        JSON.stringify(winner.numbers),
        winner.timestamp.toISOString(),
        winner.message,
        winner.walletAddress || null,
        winner.txs || null
      ], function(err) {
        if (err) {
          reject(err);
          return;
        }
        
        const winnerId = this.lastID;
        stmt.finalize();
        
        // Remove winner from whitelist if they have a wallet address
        if (winner.walletAddress) {
          db.run(`DELETE FROM whitelist WHERE wallet_address = ?`, [winner.walletAddress], function(whitelistErr) {
            if (whitelistErr) {
              console.warn(`Warning: Could not remove winner ${winner.username} (${winner.walletAddress}) from whitelist:`, whitelistErr.message);
            } else if (this.changes > 0) {
              console.log(`✅ Removed winner ${winner.username} (${winner.walletAddress}) from whitelist`);
            } else {
              console.log(`ℹ️ Winner ${winner.username} (${winner.walletAddress}) was not in whitelist`);
            }
            
            db.close();
            resolve(winnerId);
          });
        } else {
          // No wallet address, just close and resolve
          console.log(`ℹ️ Winner ${winner.username} has no wallet address to remove from whitelist`);
          db.close();
          resolve(winnerId);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Get winners for a specific username
export async function getWinnersByUser(username: string): Promise<LotteryWinner[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      db.all(`
        SELECT * FROM lottery_winners 
        WHERE username = ?
        ORDER BY timestamp DESC
      `, [username], (err, rows: LotteryWinnerRow[]) => {
        if (err) {
          reject(err);
        } else {
          const winners: LotteryWinner[] = rows.map(row => ({
            id: row.id,
            username: row.username,
            profileImage: row.profile_image || undefined,
            numbers: JSON.parse(row.numbers),
            timestamp: new Date(row.timestamp),
            message: row.message,
            walletAddress: row.wallet_address || undefined,
            txs: row.txs || undefined
          }));
          resolve(winners);
        }
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Get recent winners across all results
export async function getRecentWinners(limit: number = 10): Promise<LotteryWinner[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      db.all(`
        SELECT * FROM lottery_winners 
        ORDER BY timestamp DESC 
        LIMIT ?
      `, [limit], (err, rows: LotteryWinnerRow[]) => {
        if (err) {
          reject(err);
        } else {
          const winners: LotteryWinner[] = rows.map(row => ({
            id: row.id,
            username: row.username,
            profileImage: row.profile_image || undefined,
            numbers: JSON.parse(row.numbers),
            timestamp: new Date(row.timestamp),
            message: row.message,
            walletAddress: row.wallet_address || undefined,
            txs: row.txs || undefined
          }));
          resolve(winners);
        }
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Function to conduct lottery draw and find winners
export async function conductLotteryDraw(sourceTable: 'lottery_plays' | 'lottery_plays_home' = 'lottery_plays_home'): Promise<{
  result: LotteryResult;
  winners: LotteryWinner[];
}> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      // Get all plays from the source table
      const getPlaysQuery = sourceTable === 'lottery_plays_home' 
        ? 'SELECT * FROM lottery_plays_home ORDER BY timestamp DESC'
        : 'SELECT * FROM lottery_plays ORDER BY timestamp DESC';
      
      db.all(getPlaysQuery, [], async (err, rows: LotteryPlayRow[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        try {
          // Convert rows to lottery plays
          const plays: LotteryPlay[] = rows.map(row => ({
            id: row.id,
            username: row.username,
            profileImage: row.profile_image || undefined,
            numbers: JSON.parse(row.numbers),
            timestamp: new Date(row.timestamp),
            message: row.message,
            walletAddress: row.wallet_address || undefined
          }));
          
          // Pick a random row from lottery_plays_home to be the winner
          let winningNumbers: number[];
          let selectedWinner: LotteryPlay | null = null;
          
          // Always use lottery_plays_home table to pick a winner
          const homeDb = await initDatabase();
          const homePlays = await new Promise<LotteryPlayRow[]>((resolve, reject) => {
            homeDb.all(`SELECT * FROM lottery_plays_home ORDER BY timestamp DESC`, [], (err, rows: LotteryPlayRow[]) => {
              if (err) reject(err);
              else resolve(rows);
              homeDb.close();
            });
          });
          
          if (homePlays.length > 0) {
            // Pick a random entry from lottery_plays_home
            const randomIndex = Math.floor(Math.random() * homePlays.length);
            const selectedRow = homePlays[randomIndex];
            
            // Use this row's numbers as the winning numbers
            winningNumbers = JSON.parse(selectedRow.numbers).sort((a: number, b: number) => a - b);
            
            // Convert the selected row to LotteryPlay format
            selectedWinner = {
              id: selectedRow.id,
              username: selectedRow.username,
              profileImage: selectedRow.profile_image || undefined,
              numbers: JSON.parse(selectedRow.numbers),
              timestamp: new Date(selectedRow.timestamp),
              message: selectedRow.message,
              walletAddress: selectedRow.wallet_address || undefined
            };
          } else {
            // Fallback to random numbers if no submissions in lottery_plays_home
            winningNumbers = Array.from({ length: 4 }, () => Math.floor(Math.random() * 49) + 1)
              .sort((a, b) => a - b);
          }
          
          // Create winner entry based on the selected winner
          const winners: Omit<LotteryWinner, 'id'>[] = [];
          const now = new Date();
          
          if (selectedWinner) {
            // The selected winner is guaranteed to match since we used their numbers
            winners.push({
              username: selectedWinner.username,
              profileImage: selectedWinner.profileImage,
              numbers: selectedWinner.numbers, // Keep original numbers
              timestamp: now,
              message: `🎉 LUCKY! Selected as winner with numbers: ${selectedWinner.numbers.join(', ')}`,
              walletAddress: selectedWinner.walletAddress,
              txs: undefined // Set to undefined initially, can be updated later with actual transaction hash
            });
          }
          
          // Save result
          const resultData: Omit<LotteryResult, 'id'> = {
            winning_numbers: winningNumbers,
            draw_timestamp: now,
            total_players: plays.length,
            total_winners: winners.length,
            jackpot_amount: calculateJackpot(plays.length),
            source_table: sourceTable
          };
          
          const resultId = await saveLotteryResult(resultData);
          
          // Save winners
          const savedWinners: LotteryWinner[] = [];
          for (const winner of winners) {
            const winnerId = await saveLotteryWinner(winner);
            savedWinners.push({
              ...winner,
              id: winnerId
            });
          }
          
          db.close();
          resolve({
            result: { ...resultData, id: resultId },
            winners: savedWinners
          });
          
        } catch (error) {
          db.close();
          reject(error);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Helper function to calculate jackpot based on player count
function calculateJackpot(playerCount: number): string {
  const baseJackpot = 100000; // $100,000 base
  const perPlayerBonus = 1000; // $1,000 per player
  const total = baseJackpot + (playerCount * perPlayerBonus);
  return `$${total.toLocaleString()}`;
}

// ========== CONFIG FUNCTIONS ==========

// Save or update a config value
export async function saveConfig(key: string, value: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO config (key, value, updated_at)
        VALUES (?, ?, ?)
      `);
      
      stmt.run([
        key,
        value,
        new Date().toISOString()
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
        stmt.finalize();
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Get a config value by key
export async function getConfig(key: string): Promise<string | null> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      db.get(`
        SELECT value FROM config 
        WHERE key = ?
      `, [key], (err, row: { value: string } | undefined) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.value : null);
        }
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Get all config values
export async function getAllConfig(): Promise<Record<string, string>> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      db.all(`
        SELECT key, value FROM config
      `, [], (err, rows: ConfigRow[]) => {
        if (err) {
          reject(err);
        } else {
          const config: Record<string, string> = {};
          rows.forEach(row => {
            config[row.key] = row.value;
          });
          resolve(config);
        }
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Delete a config value
export async function deleteConfig(key: string): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      db.run(`DELETE FROM config WHERE key = ?`, [key], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Specific helper functions for chat configuration
export async function saveChatConfig(chatRoomId: string, chatUsername: string): Promise<void> {
  await saveConfig('chatRoomId', chatRoomId);
  await saveConfig('chatUsername', chatUsername);
}

export async function getChatConfig(): Promise<{ chatRoomId: string | null; chatUsername: string | null }> {
  const [chatRoomId, chatUsername] = await Promise.all([
    getConfig('chatRoomId'),
    getConfig('chatUsername')
  ]);
  
  return {
    chatRoomId,
    chatUsername
  };
}

// Demo data functions
export async function generateDemoData(): Promise<{ 
  lotteryPlays: number; 
  homePlays: number; 
  results: number; 
  winners: number 
}> {
  // Sample usernames and profile images
  const sampleUsers = [
    { username: 'CryptoGamer99', profile: 'https://pump.mypinata.cloud/ipfs/QmeSzchzEPqCU1jwTnsipwcBAeH7S4bmVvFGfF65iA1BY1' },
    { username: 'LuckyPlayer', profile: 'https://ipfs.io/ipfs/QmZQZ3A6iQZKrQmLD9kQozWvtQmaeT6955pqTiyk9tNgvA' },
    { username: 'PowerballPro', profile: null },
    { username: 'NumberHunter', profile: 'https://pump.mypinata.cloud/ipfs/QmTx8K9P5zY3fGhJkL8mNqWtQrV4sX6uE2cF7bD9nA5mP1' },
    { username: 'JackpotSeeker', profile: null },
    { username: 'DigitalDreamer', profile: 'https://ipfs.io/ipfs/QmPx7Y2kZ8wV3fGhJkL8mNqWtQrV4sX6uE2cF7bD9nA5mP2' },
    { username: 'TokenTicketer', profile: null },
    { username: 'BlockchainBaller', profile: 'https://pump.mypinata.cloud/ipfs/QmRx8K9P5zY3fGhJkL8mNqWtQrV4sX6uE2cF7bD9nA5mP3' },
    { username: 'CoinCollector', profile: null },
    { username: 'LotteryLegend', profile: 'https://ipfs.io/ipfs/QmSx7Y2kZ8wV3fGhJkL8mNqWtQrV4sX6uE2cF7bD9nA5mP4' }
  ];

  // Generate random wallet addresses
  const generateWalletAddress = (): string => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789';
    let result = '';
    for (let i = 0; i < 44; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Generate random 4-number combination
  const generateRandomNumbers = (): number[] => {
    const numbers: number[] = [];
    for (let i = 0; i < 4; i++) {
      numbers.push(Math.floor(Math.random() * 49) + 1); // 1-49
    }
    return numbers;
  };

  // Generate lottery plays
  let lotteryPlayCount = 0;
  for (let i = 0; i < 25; i++) {
    const user = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
    const numbers = generateRandomNumbers();
    const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Last 7 days
    
    const playData: Omit<LotteryPlay, 'id'> = {
      username: user.username,
      profileImage: user.profile || undefined,
      numbers: numbers,
      timestamp: timestamp,
      message: `/push ${numbers.join(' ')}`,
      walletAddress: generateWalletAddress()
    };
    
    await saveLotteryPlay(playData);
    lotteryPlayCount++;
  }

  // Generate home lottery plays
  let homePlayCount = 0;
  for (let i = 0; i < 15; i++) {
    const user = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
    const numbers = generateRandomNumbers();
    const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Last 7 days
    
    const playData: Omit<LotteryPlay, 'id'> = {
      username: user.username,
      profileImage: user.profile || undefined,
      numbers: numbers,
      timestamp: timestamp,
      message: `/push ${numbers.join(' ')}`,
      walletAddress: generateWalletAddress()
    };
    
    await saveLotteryPlayHome(playData);
    homePlayCount++;
  }

  // Generate lottery results and winners
  let resultCount = 0;
  let winnerCount = 0;
  
  for (let i = 0; i < 3; i++) {
    const drawTimestamp = new Date(Date.now() - i * 24 * 60 * 60 * 1000); // Last 3 days
    const sourceTable = i % 2 === 0 ? 'lottery_plays' : 'lottery_plays_home';
    
    // Pick a winner from the appropriate table and use their numbers
    const plays = sourceTable === 'lottery_plays' 
      ? await getRecentLotteryPlays(100)
      : await getRecentLotteryPlaysHome(100);
    
    let winningNumbers: number[];
    let selectedWinner: LotteryPlay | null = null;
    
    if (plays.length > 0) {
      // Pick a random player to be the winner
      const randomIndex = Math.floor(Math.random() * plays.length);
      selectedWinner = plays[randomIndex];
      winningNumbers = selectedWinner.numbers.sort((a, b) => a - b);
    } else {
      // Fallback to random numbers if no plays
      winningNumbers = generateRandomNumbers();
    }
    
    const resultData: Omit<LotteryResult, 'id'> = {
      winning_numbers: winningNumbers,
      draw_timestamp: drawTimestamp,
      total_players: plays.length,
      total_winners: selectedWinner ? 1 : 0, // 1 if we have a selected winner, 0 otherwise
      jackpot_amount: `$${(Math.random() * 1000000 + 100000).toFixed(0)}`,
      source_table: sourceTable
    };
    
    await saveLotteryResult(resultData);
    resultCount++;
    
    // Create winner record if we have a selected winner
    if (selectedWinner) {
      const winnerData: Omit<LotteryWinner, 'id'> = {
        username: selectedWinner.username,
        profileImage: selectedWinner.profileImage,
        numbers: selectedWinner.numbers, // Keep original numbers
        timestamp: new Date(),
        message: `🎉 JACKPOT! Selected as demo winner with numbers: ${selectedWinner.numbers.join(', ')}`,
        walletAddress: selectedWinner.walletAddress,
        txs: `demo_txs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` // Generate demo transaction hash
      };
      
      await saveLotteryWinner(winnerData);
      winnerCount++;
    }
    
    // Note: We'll skip updating the result for now since we don't have an update function
  }

  return {
    lotteryPlays: lotteryPlayCount,
    homePlays: homePlayCount,
    results: resultCount,
    winners: winnerCount
  };
}

// Update lottery_plays_home with specific usernames and remove others
export async function updateHomeLotteryPlaysWithSpecificUsers(): Promise<{ 
  updated: number; 
  deleted: number 
}> {
  return new Promise((resolve, reject) => {
    try {
      const db = new sqlite3.Database(dbPath);
      
      const targetUsernames = [
        'C7gXVD5tTBkQhjUXnB1fqGLxF5f3WP667NcwogjXVRdW',
        'FHVKQsBxAuZUjxhyYHJ1GoEKXx748tZj6xVg8PDbNLYq',
        '87bwU7rwQBZy2UbmE26ZAmwsTCikCXnQh5S17n5mmLjN',
        '3PuThZ1vkXFksRQeTinrNoNwkSEGQaaHxLgaGdARPSTJ',
        'DaBeNn4ymEHDfbU9rVLvzLt3Y9WKgKvG4MwC6MS4nhqp',
        'DQJTnp9iuZ7ULKsvrcQ6c6hrhxR8kDcbq9DdqPBPbQFS',
        '4xkLSQLZn1BNmyXK5qzpBwhuqffJFdCU2ExFUJq1TEoy',
        'GbsDU2bZVf1jM6HWdrY8dwZrYd2ZDAgkWpciJEkCHuJa',
        'BuuuBJFiL9nanHDSVHTgnhpeq8hi859S9gfL5ESVCyuz',
        'CLMtUGk7799bFxtVUvnSY2XsQJZhnFpvmZDuGknJ8NVb'
      ];
      
      let updatedCount = 0;
      let deletedCount = 0;
      
      db.serialize(() => {
        // First, get all rows to identify which ones to update
        db.all('SELECT id FROM lottery_plays_home ORDER BY id ASC', [], (err, rows: {id: number}[]) => {
          if (err) {
            reject(err);
            return;
          }
          
          let processedRows = 0;
          const totalRows = rows.length;
          
          if (totalRows === 0) {
            db.close();
            resolve({ updated: 0, deleted: 0 });
            return;
          }
          
          // Update the first 10 rows with the target usernames
          rows.forEach((row, index) => {
            if (index < targetUsernames.length && index < totalRows) {
              // Update username for this row
              db.run(
                'UPDATE lottery_plays_home SET username = ? WHERE id = ?',
                [targetUsernames[index], row.id],
                function(updateErr) {
                  if (updateErr) {
                    reject(updateErr);
                    return;
                  }
                  updatedCount += this.changes;
                  processedRows++;
                  
                  // Check if all operations are complete
                  if (processedRows === totalRows) {
                    finishOperation();
                  }
                }
              );
            } else {
              // Delete this row (it's beyond the 10 we want to keep)
              db.run(
                'DELETE FROM lottery_plays_home WHERE id = ?',
                [row.id],
                function(deleteErr) {
                  if (deleteErr) {
                    reject(deleteErr);
                    return;
                  }
                  deletedCount += this.changes;
                  processedRows++;
                  
                  // Check if all operations are complete
                  if (processedRows === totalRows) {
                    finishOperation();
                  }
                }
              );
            }
          });
          
          function finishOperation() {
            db.close((closeErr) => {
              if (closeErr) {
                reject(closeErr);
              } else {
                resolve({ updated: updatedCount, deleted: deletedCount });
              }
            });
          }
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function clearAllDemoData(): Promise<{ 
  lotteryPlays: number; 
  homePlays: number; 
  results: number; 
  winners: number 
}> {
  return new Promise((resolve, reject) => {
    try {
      const db = new sqlite3.Database(dbPath);
      
      const deletedCounts = {
        lotteryPlays: 0,
        homePlays: 0,
        results: 0,
        winners: 0
      };
      
      // Delete in correct order due to foreign key constraints
      db.serialize(() => {
        // Delete winners first (references results and plays)
        db.run('DELETE FROM lottery_winners', function(err) {
          if (err) {
            reject(err);
            return;
          }
          deletedCounts.winners = this.changes;
        });
        
        // Delete results
        db.run('DELETE FROM lottery_results', function(err) {
          if (err) {
            reject(err);
            return;
          }
          deletedCounts.results = this.changes;
        });
        
        // Delete lottery plays
        db.run('DELETE FROM lottery_plays', function(err) {
          if (err) {
            reject(err);
            return;
          }
          deletedCounts.lotteryPlays = this.changes;
        });
        
        // Delete home lottery plays
        db.run('DELETE FROM lottery_plays_home', function(err) {
          if (err) {
            reject(err);
            return;
          }
          deletedCounts.homePlays = this.changes;
          
          // Close database and resolve
          db.close((closeErr) => {
            if (closeErr) {
              reject(closeErr);
            } else {
              resolve(deletedCounts);
            }
          });
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function clearAllDataExceptHomeLottery(): Promise<{ 
  lotteryPlays: number; 
  results: number; 
  winners: number 
}> {
  return new Promise((resolve, reject) => {
    try {
      const db = new sqlite3.Database(dbPath);
      
      const deletedCounts = {
        lotteryPlays: 0,
        results: 0,
        winners: 0
      };
      
      // Delete in correct order due to foreign key constraints
      // Note: NOT deleting lottery_plays_home table
      db.serialize(() => {
        // Delete winners first (references results and plays)
        db.run('DELETE FROM lottery_winners', function(err) {
          if (err) {
            reject(err);
            return;
          }
          deletedCounts.winners = this.changes;
        });
        
        // Delete results
        db.run('DELETE FROM lottery_results', function(err) {
          if (err) {
            reject(err);
            return;
          }
          deletedCounts.results = this.changes;
        });
        
        // Delete lottery plays (but NOT home lottery plays)
        db.run('DELETE FROM lottery_plays', function(err) {
          if (err) {
            reject(err);
            return;
          }
          deletedCounts.lotteryPlays = this.changes;
          
          // Close database and resolve (HomeLotteryPlays preserved)
          db.close((closeErr) => {
            if (closeErr) {
              reject(closeErr);
            } else {
              resolve(deletedCounts);
            }
          });
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

// ========== WHITELIST FUNCTIONS ==========

// Add a wallet address to the whitelist
export async function addToWhitelist(walletAddress: string): Promise<number> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO whitelist (wallet_address, created_at, is_active)
        VALUES (?, ?, 1)
      `);
      
      stmt.run([
        walletAddress,
        new Date().toISOString()
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
        stmt.finalize();
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Remove a wallet address from the whitelist
export async function removeFromWhitelist(walletAddress: string): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      db.run(`DELETE FROM whitelist WHERE wallet_address = ?`, [walletAddress], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Check if a wallet address is whitelisted
export async function isWhitelisted(walletAddress: string): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      db.get(`
        SELECT id FROM whitelist 
        WHERE wallet_address = ? AND is_active = 1
      `, [walletAddress], (err, row: WhitelistRow | undefined) => {
        if (err) {
          reject(err);
        } else {
          resolve(!!row);
        }
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Get all whitelisted addresses
export async function getAllWhitelistedAddresses(): Promise<Whitelist[]> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      db.all(`
        SELECT * FROM whitelist 
        WHERE is_active = 1 
        ORDER BY created_at DESC
      `, [], (err, rows: WhitelistRow[]) => {
        if (err) {
          reject(err);
        } else {
          const whitelistEntries: Whitelist[] = rows.map(row => ({
            id: row.id,
            wallet_address: row.wallet_address,
            created_at: new Date(row.created_at),
            is_active: row.is_active === 1
          }));
          resolve(whitelistEntries);
        }
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Update whitelist status (activate/deactivate)
export async function updateWhitelistStatus(walletAddress: string, isActive: boolean): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await initDatabase();
      
      db.run(`
        UPDATE whitelist 
        SET is_active = ? 
        WHERE wallet_address = ?
      `, [isActive ? 1 : 0, walletAddress], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
        db.close();
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Initialize whitelist with predefined addresses
export async function initializeWhitelist(): Promise<void> {
  const predefinedAddresses = [
    'C7gXVD5tTBkQhjUXnB1fqGLxF5f3WP667NcwogjXVRdW',
    'FHVKQsBxAuZUjxhyYHJ1GoEKXx748tZj6xVg8PDbNLYq',
    '87bwU7rwQBZy2UbmE26ZAmwsTCikCXnQh5S17n5mmLjN',
    '3PuThZ1vkXFksRQeTinrNoNwkSEGQaaHxLgaGdARPSTJ',
    'DaBeNn4ymEHDfbU9rVLvzLt3Y9WKgKvG4MwC6MS4nhqp',
    'DQJTnp9iuZ7ULKsvrcQ6c6hrhxR8kDcbq9DdqPBPbQFS',
    '4xkLSQLZn1BNmyXK5qzpBwhuqffJFdCU2ExFUJq1TEoy',
    'GbsDU2bZVf1jM6HWdrY8dwZrYd2ZDAgkWpciJEkCHuJa',
    'BuuuBJFiL9nanHDSVHTgnhpeq8hi859S9gfL5ESVCyuz',
    'CLMtUGk7799bFxtVUvnSY2XsQJZhnFpvmZDuGknJ8NVb'
  ];

  for (const address of predefinedAddresses) {
    try {
      await addToWhitelist(address);
      console.log(`✅ Added ${address} to whitelist`);
    } catch (error) {
      console.error(`❌ Failed to add ${address} to whitelist:`, error);
    }
  }
}