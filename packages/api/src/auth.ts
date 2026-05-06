import { Request, Response, NextFunction } from 'express'

export function requireAuth(token: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization
    if (!authHeader || authHeader.trim() !== `Bearer ${token}`) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    next()
  }
}
