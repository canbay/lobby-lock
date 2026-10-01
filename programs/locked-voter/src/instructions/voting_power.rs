use crate::*;

#[derive(Accounts)]
pub struct VotingPower<'info> {
    pub locker: Account<'info, Locker>,
    #[account(has_one = locker)]
    pub escrow: Account<'info, Escrow>,
}
