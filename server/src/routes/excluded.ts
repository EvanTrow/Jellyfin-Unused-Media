import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { ExcludedItem } from '../types';

const router = Router();
const DATA_FILE = path.join(__dirname, '../../data/excluded.json');

async function readExcluded(): Promise<ExcludedItem[]> {
  try {
    const content = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(content) as ExcludedItem[];
  } catch {
    return [];
  }
}

async function writeExcluded(items: ExcludedItem[]): Promise<void> {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');
}

export async function getExcludedIds(): Promise<Set<string>> {
  const items = await readExcluded();
  return new Set(items.map((i) => i.id));
}

// GET /api/excluded
router.get('/', async (_req: Request, res: Response) => {
  try {
    const items = await readExcluded();
    res.json(items);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/excluded
router.post('/', async (req: Request, res: Response) => {
  try {
    const { id, name, type } = req.body as Partial<ExcludedItem>;

    if (!id || !name || !type) {
      res.status(400).json({ error: 'id, name, and type are required' });
      return;
    }

    const items = await readExcluded();

    if (items.some((i) => i.id === id)) {
      res.status(409).json({ error: 'Item already excluded' });
      return;
    }

    const newItem: ExcludedItem = {
      id,
      name,
      type,
      dateExcluded: new Date().toISOString(),
    };

    items.push(newItem);
    await writeExcluded(items);

    res.status(201).json(newItem);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/excluded/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const items = await readExcluded();
    const filtered = items.filter((i) => i.id !== id);

    if (filtered.length === items.length) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    await writeExcluded(filtered);
    res.status(204).send();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/excluded (clear all)
router.delete('/', async (_req: Request, res: Response) => {
  try {
    await writeExcluded([]);
    res.status(204).send();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
